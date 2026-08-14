import { Router } from "express";
import { z } from "zod";
import { currentUserId, requireAuth } from "../auth.js";
import { prisma } from "../db.js";
import { env } from "../env.js";
import { badRequest, conflict, handler, notFound, parse } from "../http.js";
import { historyFor, postTx, systemAccount, userAccount, userBalance } from "../ledger.js";
import {
  COIN,
  MIN_PAYOUT_COINS,
  PAYOUT_RATE_USD_CENTS_PER_COIN,
  TOPUP_PACKS,
  TOPUP_RATE_USD_CENTS_PER_COIN,
  findPack,
  payoutUsdCents,
} from "../money.js";
import {
  createConnectAccount,
  createOnboardingLink,
  stripe,
  stripeEnabled,
} from "../stripe.js";

export const walletRouter = Router();

walletRouter.get(
  "/",
  requireAuth,
  handler(async (req, res) => {
    const userId = currentUserId(req);
    const [balanceCoins, user] = await Promise.all([
      userBalance(prisma, userId),
      prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    ]);

    res.json({
      balanceCoins,
      packs: TOPUP_PACKS,
      rates: {
        coinMinorUnits: COIN,
        topUpUsdCentsPerCoin: TOPUP_RATE_USD_CENTS_PER_COIN,
        payoutUsdCentsPerCoin: PAYOUT_RATE_USD_CENTS_PER_COIN,
        minPayoutCoins: MIN_PAYOUT_COINS,
      },
      payouts: {
        enabled: user.payoutsEnabled,
        onboardingStarted: Boolean(user.stripeAccountId),
        availableUsdCents: payoutUsdCents(balanceCoins),
      },
      sandbox: !stripeEnabled,
    });
  }),
);

walletRouter.get(
  "/history",
  requireAuth,
  handler(async (req, res) => {
    const userId = currentUserId(req);
    res.json({ entries: await historyFor(prisma, userId) });
  }),
);

/**
 * Buy coins.
 *
 * Note what is NOT here: Apple's in-app purchase. App Store rules forbid using
 * IAP for anything redeemable against physical goods, and this currency buys
 * second-hand furniture. Card payment through Stripe is the compliant path — and
 * it's also the cheap one, since Apple's 30% would swallow the entire spread.
 */
walletRouter.post(
  "/topup",
  requireAuth,
  handler(async (req, res) => {
    const userId = currentUserId(req);
    const { packId } = parse(z.object({ packId: z.string() }), req.body);

    const pack = findPack(packId);
    if (!pack) throw badRequest("Unknown coin pack");

    const topUp = await prisma.topUp.create({
      data: {
        userId,
        usdCents: pack.usdCents,
        coins: pack.coins,
        bonusCoins: pack.bonusCoins,
      },
    });

    if (!stripe) {
      // Sandbox: no card, no Checkout — credit the coins straight away so the rest
      // of the app is testable end to end.
      await creditTopUp(topUp.id);
      res.json({
        sandbox: true,
        topUpId: topUp.id,
        balanceCoins: await userBalance(prisma, userId),
      });
      return;
    }

    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const totalCoins = pack.coins + pack.bonusCoins;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: user.email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: pack.usdCents,
            product_data: {
              name: `${totalCoins / COIN} coins`,
              description:
                pack.bonusCoins > 0
                  ? `${pack.coins / COIN} coins + ${pack.bonusCoins / COIN} bonus`
                  : undefined,
            },
          },
        },
      ],
      // The webhook is what actually credits coins; these just bounce the user
      // back into the app.
      success_url: `${env.appScheme}://wallet?topup=success`,
      cancel_url: `${env.appScheme}://wallet?topup=cancelled`,
      metadata: { topUpId: topUp.id, userId },
    });

    await prisma.topUp.update({
      where: { id: topUp.id },
      data: { stripeSessionId: session.id },
    });

    res.json({ sandbox: false, topUpId: topUp.id, checkoutUrl: session.url });
  }),
);

/**
 * Credit a paid top-up exactly once.
 *
 * Called from the Stripe webhook (and directly in sandbox mode). Stripe retries
 * webhooks, so the status guard inside the transaction is what makes this safe to
 * run twice.
 */
export async function creditTopUp(topUpId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const topUp = await tx.topUp.findUnique({ where: { id: topUpId } });
    if (!topUp) throw notFound("Top-up not found");
    if (topUp.status === "COMPLETED") return; // already handled — Stripe is retrying

    const account = await userAccount(tx, topUp.userId);
    const mint = await systemAccount(tx, "SYSTEM_MINT");

    // Coins come into existence here. SYSTEM_MINT goes negative by the same
    // amount, so the ledger as a whole still sums to zero and its balance is the
    // exact number of coins in circulation.
    await postTx(tx, {
      kind: "TOPUP",
      reference: `topup:${topUp.id}`,
      memo: `Bought ${topUp.coins / COIN} coins`,
      entries: [
        { accountId: mint, delta: -topUp.coins },
        { accountId: account, delta: topUp.coins },
      ],
    });

    if (topUp.bonusCoins > 0) {
      await postTx(tx, {
        kind: "BONUS",
        reference: `topup:${topUp.id}`,
        memo: `Bonus ${topUp.bonusCoins / COIN} coins`,
        entries: [
          { accountId: mint, delta: -topUp.bonusCoins },
          { accountId: account, delta: topUp.bonusCoins },
        ],
      });
    }

    await tx.topUp.update({ where: { id: topUp.id }, data: { status: "COMPLETED" } });
  });
}

/** Start (or resume) Stripe Connect onboarding so this user can receive dollars. */
walletRouter.post(
  "/connect",
  requireAuth,
  handler(async (req, res) => {
    const userId = currentUserId(req);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

    if (!stripe) {
      // Sandbox: pretend KYC passed so the payout flow can be exercised locally.
      await prisma.user.update({ where: { id: userId }, data: { payoutsEnabled: true } });
      res.json({ sandbox: true, payoutsEnabled: true });
      return;
    }

    const accountId = user.stripeAccountId ?? (await createConnectAccount(user.email));
    if (!user.stripeAccountId) {
      await prisma.user.update({ where: { id: userId }, data: { stripeAccountId: accountId } });
    }

    res.json({ sandbox: false, onboardingUrl: await createOnboardingLink(accountId) });
  }),
);

/**
 * Cash out coins to real dollars.
 *
 * Coins are burned into SYSTEM_PAYOUT at the payout rate, which is deliberately
 * below the top-up rate — that spread is the platform's revenue (see money.ts).
 */
walletRouter.post(
  "/payout",
  requireAuth,
  handler(async (req, res) => {
    const userId = currentUserId(req);
    const { coins } = parse(
      z.object({ coins: z.number().int().positive() }),
      req.body,
    );

    if (coins < MIN_PAYOUT_COINS) {
      throw badRequest(`Minimum cash-out is ${MIN_PAYOUT_COINS / COIN} coins`);
    }

    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.payoutsEnabled) {
      throw conflict("Finish setting up payouts first", "payouts_not_enabled");
    }

    const usdCents = payoutUsdCents(coins);

    // Burn first, transfer second. If the Stripe call fails we refund below; the
    // opposite order could pay out coins the user never had.
    const payout = await prisma.$transaction(async (tx) => {
      const account = await userAccount(tx, userId);
      const burn = await systemAccount(tx, "SYSTEM_PAYOUT");

      const created = await tx.payout.create({ data: { userId, coins, usdCents } });

      await postTx(tx, {
        kind: "PAYOUT",
        reference: `payout:${created.id}`,
        memo: `Cashed out $${(usdCents / 100).toFixed(2)}`,
        entries: [
          { accountId: account, delta: -coins },
          { accountId: burn, delta: coins },
        ],
      });

      return created;
    });

    if (!stripe || !user.stripeAccountId) {
      await prisma.payout.update({ where: { id: payout.id }, data: { status: "PAID" } });
      res.json({
        sandbox: true,
        payout: { ...payout, status: "PAID" },
        balanceCoins: await userBalance(prisma, userId),
      });
      return;
    }

    try {
      const transfer = await stripe.transfers.create({
        amount: usdCents,
        currency: "usd",
        destination: user.stripeAccountId,
        metadata: { payoutId: payout.id, userId },
      });
      await prisma.payout.update({
        where: { id: payout.id },
        data: { status: "PAID", stripeTransferId: transfer.id },
      });
    } catch (error) {
      // Give the coins back — the seller should not lose value because our
      // transfer failed.
      await prisma.$transaction(async (tx) => {
        const account = await userAccount(tx, userId);
        const burn = await systemAccount(tx, "SYSTEM_PAYOUT");
        await postTx(tx, {
          kind: "REFUND",
          reference: `payout:${payout.id}`,
          memo: "Cash-out failed, coins returned",
          entries: [
            { accountId: burn, delta: -coins },
            { accountId: account, delta: coins },
          ],
        });
        await tx.payout.update({ where: { id: payout.id }, data: { status: "FAILED" } });
      });
      console.error("[payout] transfer failed", error);
      throw conflict("Cash-out failed, your coins were returned", "payout_failed");
    }

    res.json({
      sandbox: false,
      payout: await prisma.payout.findUniqueOrThrow({ where: { id: payout.id } }),
      balanceCoins: await userBalance(prisma, userId),
    });
  }),
);
