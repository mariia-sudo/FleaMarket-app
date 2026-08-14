import express, { Router } from "express";
import type Stripe from "stripe";
import { prisma } from "../db.js";
import { env } from "../env.js";
import { stripe } from "../stripe.js";
import { creditTopUp } from "./wallet.js";

export const stripeWebhookRouter = Router();

/**
 * Stripe webhook.
 *
 * Mounted before the JSON body parser in index.ts because signature verification
 * needs the exact raw bytes Stripe sent.
 *
 * Local testing:
 *   stripe listen --forward-to localhost:4000/stripe/webhook
 */
stripeWebhookRouter.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    if (!stripe || !env.stripeWebhookSecret) {
      res.status(503).json({ error: "Stripe is not configured" });
      return;
    }

    const signature = req.headers["stripe-signature"];
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        signature as string,
        env.stripeWebhookSecret,
      );
    } catch (error) {
      console.error("[stripe] bad signature", error);
      res.status(400).json({ error: "Invalid signature" });
      return;
    }

    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object;
          const topUpId = session.metadata?.topUpId;
          // `creditTopUp` is idempotent, which matters because Stripe retries.
          if (topUpId) await creditTopUp(topUpId);
          break;
        }

        case "checkout.session.expired": {
          const session = event.data.object;
          const topUpId = session.metadata?.topUpId;
          if (topUpId) {
            await prisma.topUp.updateMany({
              where: { id: topUpId, status: "PENDING" },
              data: { status: "FAILED" },
            });
          }
          break;
        }

        case "account.updated": {
          // Fires when a seller finishes (or breaks) Connect onboarding. This is
          // the only thing that flips payoutsEnabled — we never take the client's
          // word for it.
          const account = event.data.object;
          await prisma.user.updateMany({
            where: { stripeAccountId: account.id },
            data: { payoutsEnabled: Boolean(account.payouts_enabled) },
          });
          break;
        }

        default:
          break;
      }
    } catch (error) {
      // Return 500 so Stripe retries rather than dropping the event.
      console.error(`[stripe] failed handling ${event.type}`, error);
      res.status(500).json({ error: "Handler failed" });
      return;
    }

    res.json({ received: true });
  },
);
