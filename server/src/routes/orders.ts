import { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { currentUserId, requireAuth } from "../auth.js";
import { prisma } from "../db.js";
import { badRequest, conflict, forbidden, handler, notFound, param, parse } from "../http.js";
import { postTx, systemAccount, userAccount } from "../ledger.js";
import { feeFor } from "../money.js";
import { publicOrder } from "../serialize.js";

export const ordersRouter = Router();

const orderInclude = {
  listing: { include: { photos: true } },
  buyer: true,
  seller: true,
} satisfies Prisma.OrderInclude;

/**
 * Buy a listing.
 *
 * The coins leave the buyer immediately but land in escrow, not in the seller's
 * wallet. They're released when the buyer confirms they got the item — which is
 * the whole reason a local pickup marketplace is worth building on an internal
 * currency instead of "meet up and hand over cash".
 */
ordersRouter.post(
  "/",
  requireAuth,
  handler(async (req, res) => {
    const buyerId = currentUserId(req);
    const { listingId } = parse(z.object({ listingId: z.string() }), req.body);

    const order = await prisma.$transaction(async (tx) => {
      const listing = await tx.listing.findUnique({ where: { id: listingId } });
      if (!listing) throw notFound("Listing not found");
      if (listing.sellerId === buyerId) throw badRequest("You can't buy your own listing");
      if (listing.status !== "ACTIVE") {
        throw conflict("This item is no longer available", "listing_unavailable");
      }

      const amountCoins = listing.priceCoins;
      const feeCoins = feeFor(amountCoins);

      const created = await tx.order.create({
        data: {
          listingId: listing.id,
          buyerId,
          sellerId: listing.sellerId,
          amountCoins,
          feeCoins,
          status: "ESCROW",
        },
      });

      const buyerAccount = await userAccount(tx, buyerId);
      const escrow = await systemAccount(tx, "SYSTEM_ESCROW");

      // postTx throws `insufficient_funds` if this would overdraw the buyer, which
      // rolls the whole transaction back — order row included.
      await postTx(tx, {
        kind: "PURCHASE",
        reference: `order:${created.id}`,
        memo: listing.title,
        entries: [
          { accountId: buyerAccount, delta: -amountCoins },
          { accountId: escrow, delta: amountCoins },
        ],
      });

      // Hide it from the feed while the handoff is being arranged.
      await tx.listing.update({ where: { id: listing.id }, data: { status: "RESERVED" } });

      return tx.order.findUniqueOrThrow({ where: { id: created.id }, include: orderInclude });
    });

    res.status(201).json({ order: publicOrder(order) });
  }),
);

/** Buyer confirms the handoff: escrow is released to the seller. */
ordersRouter.post(
  "/:id/confirm",
  requireAuth,
  handler(async (req, res) => {
    const userId = currentUserId(req);

    const order = await prisma.$transaction(async (tx) => {
      const existing = await tx.order.findUnique({ where: { id: param(req, "id") } });
      if (!existing) throw notFound("Order not found");
      if (existing.buyerId !== userId) {
        throw forbidden("Only the buyer can confirm they received the item");
      }
      if (existing.status !== "ESCROW") {
        throw conflict(`This order is already ${existing.status.toLowerCase()}`);
      }

      const escrow = await systemAccount(tx, "SYSTEM_ESCROW");
      const sellerAccount = await userAccount(tx, existing.sellerId);
      const feeAccount = await systemAccount(tx, "SYSTEM_FEE");

      const toSeller = existing.amountCoins - existing.feeCoins;
      const entries = [
        { accountId: escrow, delta: -existing.amountCoins },
        { accountId: sellerAccount, delta: toSeller },
      ];
      // With PLATFORM_FEE_BPS at 0 there's nothing to book, and a zero-value entry
      // would just be noise in the seller's history.
      if (existing.feeCoins > 0) {
        entries.push({ accountId: feeAccount, delta: existing.feeCoins });
      }

      await postTx(tx, {
        kind: "RELEASE",
        reference: `order:${existing.id}`,
        memo: "Sale completed",
        entries,
      });

      await tx.listing.update({ where: { id: existing.listingId }, data: { status: "SOLD" } });

      return tx.order.update({
        where: { id: existing.id },
        data: { status: "COMPLETED", completedAt: new Date() },
        include: orderInclude,
      });
    });

    res.json({ order: publicOrder(order) });
  }),
);

/** Either side backs out before the handoff: escrow goes back to the buyer. */
ordersRouter.post(
  "/:id/cancel",
  requireAuth,
  handler(async (req, res) => {
    const userId = currentUserId(req);

    const order = await prisma.$transaction(async (tx) => {
      const existing = await tx.order.findUnique({ where: { id: param(req, "id") } });
      if (!existing) throw notFound("Order not found");
      if (existing.buyerId !== userId && existing.sellerId !== userId) {
        throw forbidden("That isn't your order");
      }
      if (existing.status !== "ESCROW") {
        throw conflict(`This order is already ${existing.status.toLowerCase()}`);
      }

      const escrow = await systemAccount(tx, "SYSTEM_ESCROW");
      const buyerAccount = await userAccount(tx, existing.buyerId);

      await postTx(tx, {
        kind: "REFUND",
        reference: `order:${existing.id}`,
        memo: "Order cancelled",
        entries: [
          { accountId: escrow, delta: -existing.amountCoins },
          { accountId: buyerAccount, delta: existing.amountCoins },
        ],
      });

      // Back on the market.
      await tx.listing.update({
        where: { id: existing.listingId },
        data: { status: "ACTIVE" },
      });

      return tx.order.update({
        where: { id: existing.id },
        data: { status: "CANCELLED" },
        include: orderInclude,
      });
    });

    res.json({ order: publicOrder(order) });
  }),
);

/**
 * Leave a review on a finished trade.
 *
 * The guards here are the entire anti-fake-review design, so they're worth
 * spelling out: the order must be COMPLETED (coins actually changed hands), the
 * author must have been one of the two participants, the subject is always the
 * other one, and the unique index on (orderId, authorId) means one review per
 * person per trade. There is no endpoint that creates a review any other way.
 */
ordersRouter.post(
  "/:id/review",
  requireAuth,
  handler(async (req, res) => {
    const userId = currentUserId(req);
    const body = parse(
      z.object({
        rating: z.number().int().min(1).max(5),
        body: z.string().trim().max(600).optional(),
      }),
      req.body,
    );

    const order = await prisma.order.findUnique({ where: { id: param(req, "id") } });
    if (!order) throw notFound("Order not found");
    if (order.buyerId !== userId && order.sellerId !== userId) {
      throw forbidden("That isn't your order");
    }
    if (order.status !== "COMPLETED") {
      throw badRequest("You can only review a trade that went through");
    }

    const subjectId = order.buyerId === userId ? order.sellerId : order.buyerId;

    const existing = await prisma.review.findUnique({
      where: { orderId_authorId: { orderId: order.id, authorId: userId } },
    });
    if (existing) throw conflict("You've already reviewed this trade", "already_reviewed");

    const review = await prisma.review.create({
      data: {
        orderId: order.id,
        authorId: userId,
        subjectId,
        rating: body.rating,
        body: body.body || null,
      },
    });

    res.status(201).json({
      review: {
        id: review.id,
        rating: review.rating,
        body: review.body,
        createdAt: review.createdAt,
      },
    });
  }),
);

/** Whether this user still owes a review on this order — drives the prompt in the app. */
ordersRouter.get(
  "/:id/review",
  requireAuth,
  handler(async (req, res) => {
    const userId = currentUserId(req);
    const review = await prisma.review.findUnique({
      where: { orderId_authorId: { orderId: param(req, "id"), authorId: userId } },
    });
    res.json({ reviewed: Boolean(review), rating: review?.rating ?? null });
  }),
);

ordersRouter.get(
  "/",
  requireAuth,
  handler(async (req, res) => {
    const userId = currentUserId(req);
    const { role } = parse(
      z.object({ role: z.enum(["buying", "selling", "all"]).default("all") }),
      req.query,
    );

    const where =
      role === "buying"
        ? { buyerId: userId }
        : role === "selling"
          ? { sellerId: userId }
          : { OR: [{ buyerId: userId }, { sellerId: userId }] };

    const orders = await prisma.order.findMany({
      where,
      include: orderInclude,
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    res.json({ orders: orders.map(publicOrder) });
  }),
);

ordersRouter.get(
  "/:id",
  requireAuth,
  handler(async (req, res) => {
    const userId = currentUserId(req);
    const order = await prisma.order.findUnique({
      where: { id: param(req, "id") },
      include: orderInclude,
    });
    if (!order) throw notFound("Order not found");
    if (order.buyerId !== userId && order.sellerId !== userId) {
      throw forbidden("That isn't your order");
    }
    res.json({ order: publicOrder(order) });
  }),
);
