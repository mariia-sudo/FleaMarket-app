import { Router } from "express";
import { z } from "zod";
import { currentUserId, requireAuth } from "../auth.js";
import { prisma } from "../db.js";
import { badRequest, forbidden, handler, notFound, param, parse } from "../http.js";
import { publicUser } from "../serialize.js";

export const chatRouter = Router();

/**
 * Minimal messaging: one thread per (listing, buyer), polled by the client.
 * Good enough for a base — swap the polling for websockets when there's traffic
 * worth pushing.
 */

/** Open or resume the conversation about a listing. Sellers can't start one. */
chatRouter.post(
  "/threads",
  requireAuth,
  handler(async (req, res) => {
    const userId = currentUserId(req);
    const { listingId } = parse(z.object({ listingId: z.string() }), req.body);

    const listing = await prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing) throw notFound("Listing not found");
    if (listing.sellerId === userId) {
      throw badRequest("Open the conversation from your inbox instead");
    }

    const thread = await prisma.thread.upsert({
      where: { listingId_buyerId: { listingId, buyerId: userId } },
      create: { listingId, buyerId: userId },
      update: {},
    });

    res.json({ threadId: thread.id });
  }),
);

chatRouter.get(
  "/threads",
  requireAuth,
  handler(async (req, res) => {
    const userId = currentUserId(req);

    const threads = await prisma.thread.findMany({
      where: {
        OR: [{ buyerId: userId }, { listing: { sellerId: userId } }],
      },
      orderBy: { lastMessageAt: "desc" },
      include: {
        buyer: true,
        listing: { include: { photos: true, seller: true } },
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      take: 100,
    });

    res.json({
      threads: threads.map((thread) => {
        const iAmBuyer = thread.buyerId === userId;
        const cover = [...thread.listing.photos].sort((a, b) => a.position - b.position)[0];
        return {
          id: thread.id,
          lastMessageAt: thread.lastMessageAt,
          lastMessage: thread.messages[0]?.body ?? null,
          // Always show the person on the other side, whichever side that is.
          counterparty: publicUser(iAmBuyer ? thread.listing.seller : thread.buyer),
          role: iAmBuyer ? "buying" : "selling",
          listing: {
            id: thread.listing.id,
            title: thread.listing.title,
            priceCoins: thread.listing.priceCoins,
            status: thread.listing.status,
            coverUrl: cover?.url ?? null,
          },
        };
      }),
    });
  }),
);

chatRouter.get(
  "/threads/:id/messages",
  requireAuth,
  handler(async (req, res) => {
    const userId = currentUserId(req);
    const thread = await loadThread(param(req, "id"), userId);

    const messages = await prisma.message.findMany({
      where: { threadId: thread.id },
      orderBy: { createdAt: "asc" },
      take: 200,
    });

    res.json({
      messages: messages.map((m) => ({
        id: m.id,
        body: m.body,
        createdAt: m.createdAt,
        mine: m.senderId === userId,
      })),
    });
  }),
);

chatRouter.post(
  "/threads/:id/messages",
  requireAuth,
  handler(async (req, res) => {
    const userId = currentUserId(req);
    const { body } = parse(
      z.object({ body: z.string().trim().min(1).max(1000) }),
      req.body,
    );

    const thread = await loadThread(param(req, "id"), userId);

    const message = await prisma.$transaction(async (tx) => {
      const created = await tx.message.create({
        data: { threadId: thread.id, senderId: userId, body },
      });
      // Keeps the inbox sorted without an aggregate query on every load.
      await tx.thread.update({
        where: { id: thread.id },
        data: { lastMessageAt: created.createdAt },
      });
      return created;
    });

    res.status(201).json({
      message: { id: message.id, body: message.body, createdAt: message.createdAt, mine: true },
    });
  }),
);

/** Loads a thread only if this user is one of its two participants. */
async function loadThread(threadId: string, userId: string) {
  const thread = await prisma.thread.findUnique({
    where: { id: threadId },
    include: { listing: true },
  });
  if (!thread) throw notFound("Conversation not found");
  if (thread.buyerId !== userId && thread.listing.sellerId !== userId) {
    throw forbidden("That isn't your conversation");
  }
  return thread;
}
