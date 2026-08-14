import { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { currentUserId, optionalAuth, requireAuth } from "../auth.js";
import { prisma } from "../db.js";
import { badRequest, forbidden, handler, notFound, param, parse } from "../http.js";
import { COIN } from "../money.js";
import { publicListing } from "../serialize.js";
import { CATEGORIES, CONDITIONS } from "../types.js";

export const listingsRouter = Router();

const listQuery = z.object({
  q: z.string().trim().min(1).max(80).optional(),
  category: z.enum(CATEGORIES).optional(),
  condition: z.enum(CONDITIONS).optional(),
  minCoins: z.coerce.number().int().nonnegative().optional(),
  maxCoins: z.coerce.number().int().positive().optional(),
  sellerId: z.string().optional(),
  // Cursor pagination on createdAt: pass the `nextCursor` from the last page.
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

listingsRouter.get(
  "/",
  optionalAuth,
  handler(async (req, res) => {
    const query = parse(listQuery, req.query);

    const where: Prisma.ListingWhereInput = {
      status: "ACTIVE",
      ...(query.category ? { category: query.category } : {}),
      ...(query.condition ? { condition: query.condition } : {}),
      ...(query.sellerId ? { sellerId: query.sellerId } : {}),
    };

    if (query.minCoins !== undefined || query.maxCoins !== undefined) {
      where.priceCoins = {
        ...(query.minCoins !== undefined ? { gte: query.minCoins } : {}),
        ...(query.maxCoins !== undefined ? { lte: query.maxCoins } : {}),
      };
    }

    // `mode: insensitive` is not optional: Postgres LIKE is case-sensitive, so
    // without it searching "Dresser" would miss a listing titled "dresser".
    // Good enough until the catalogue is big enough to want a tsvector index.
    if (query.q) {
      where.OR = [
        { title: { contains: query.q, mode: "insensitive" } },
        { description: { contains: query.q, mode: "insensitive" } },
      ];
    }

    const rows = await prisma.listing.findMany({
      where,
      include: { photos: true, seller: true },
      orderBy: { createdAt: "desc" },
      take: query.limit + 1, // one extra row tells us whether another page exists
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });

    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;

    const favorited = await favoritedIds(req.userId, page.map((l) => l.id));

    res.json({
      listings: page.map((l) => publicListing(l, { favorited: favorited.has(l.id) })),
      nextCursor: hasMore ? page[page.length - 1]!.id : null,
    });
  }),
);

listingsRouter.get(
  "/favorites",
  requireAuth,
  handler(async (req, res) => {
    const userId = currentUserId(req);
    const favorites = await prisma.favorite.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: { listing: { include: { photos: true, seller: true } } },
    });
    res.json({
      listings: favorites.map((f) => publicListing(f.listing, { favorited: true })),
    });
  }),
);

listingsRouter.get(
  "/:id",
  optionalAuth,
  handler(async (req, res) => {
    const listing = await prisma.listing.findUnique({
      where: { id: param(req, "id") },
      include: { photos: true, seller: true },
    });
    if (!listing || listing.status === "REMOVED") throw notFound("Listing not found");

    const favorited = await favoritedIds(req.userId, [listing.id]);
    res.json({ listing: publicListing(listing, { favorited: favorited.has(listing.id) }) });
  }),
);

const createBody = z.object({
  title: z.string().trim().min(3).max(80),
  description: z.string().trim().min(1).max(2000),
  // Prices are in minor coin units, so a $25 item is 2500. Cap at 100k coins to
  // catch the "typed the price without a decimal point" class of mistake.
  priceCoins: z.number().int().min(COIN).max(100_000 * COIN),
  category: z.enum(CATEGORIES),
  condition: z.enum(CONDITIONS),
  city: z.string().max(60).optional(),
  state: z.string().length(2).optional(),
  zip: z.string().max(10).optional(),
  photoUrls: z.array(z.string()).min(1, "Add at least one photo").max(8),
});

listingsRouter.post(
  "/",
  requireAuth,
  handler(async (req, res) => {
    const userId = currentUserId(req);
    const body = parse(createBody, req.body);

    // Fall back to the seller's profile location so they don't retype it every time.
    const seller = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

    const listing = await prisma.listing.create({
      data: {
        sellerId: userId,
        title: body.title,
        description: body.description,
        priceCoins: body.priceCoins,
        category: body.category,
        condition: body.condition,
        city: body.city ?? seller.city,
        state: (body.state ?? seller.state)?.toUpperCase(),
        zip: body.zip ?? seller.zip,
        photos: {
          create: body.photoUrls.map((url, position) => ({ url, position })),
        },
      },
      include: { photos: true, seller: true },
    });

    res.status(201).json({ listing: publicListing(listing) });
  }),
);

const updateBody = createBody.partial().extend({
  status: z.enum(["ACTIVE", "REMOVED"]).optional(),
});

listingsRouter.patch(
  "/:id",
  requireAuth,
  handler(async (req, res) => {
    const userId = currentUserId(req);
    const body = parse(updateBody, req.body);

    const existing = await prisma.listing.findUnique({ where: { id: param(req, "id") } });
    if (!existing) throw notFound("Listing not found");
    if (existing.sellerId !== userId) throw forbidden("That isn't your listing");
    if (existing.status === "SOLD") throw badRequest("A sold listing can't be edited");

    const { photoUrls, ...rest } = body;

    const listing = await prisma.listing.update({
      where: { id: existing.id },
      data: {
        ...rest,
        state: rest.state?.toUpperCase(),
        // Photos are replaced wholesale — the editor always sends the full set.
        ...(photoUrls
          ? {
              photos: {
                deleteMany: {},
                create: photoUrls.map((url, position) => ({ url, position })),
              },
            }
          : {}),
      },
      include: { photos: true, seller: true },
    });

    res.json({ listing: publicListing(listing) });
  }),
);

listingsRouter.delete(
  "/:id",
  requireAuth,
  handler(async (req, res) => {
    const userId = currentUserId(req);
    const existing = await prisma.listing.findUnique({ where: { id: param(req, "id") } });
    if (!existing) throw notFound("Listing not found");
    if (existing.sellerId !== userId) throw forbidden("That isn't your listing");

    // Soft delete: orders and chat threads still point here, so the row stays.
    await prisma.listing.update({
      where: { id: existing.id },
      data: { status: "REMOVED" },
    });
    res.json({ ok: true });
  }),
);

listingsRouter.post(
  "/:id/favorite",
  requireAuth,
  handler(async (req, res) => {
    const userId = currentUserId(req);
    const listingId = param(req, "id");

    const existing = await prisma.favorite.findUnique({
      where: { userId_listingId: { userId, listingId } },
    });

    if (existing) {
      await prisma.favorite.delete({ where: { userId_listingId: { userId, listingId } } });
      res.json({ favorited: false });
      return;
    }

    const listing = await prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing) throw notFound("Listing not found");

    await prisma.favorite.create({ data: { userId, listingId } });
    res.json({ favorited: true });
  }),
);

async function favoritedIds(userId: string | undefined, listingIds: string[]) {
  if (!userId || listingIds.length === 0) return new Set<string>();
  const rows = await prisma.favorite.findMany({
    where: { userId, listingId: { in: listingIds } },
    select: { listingId: true },
  });
  return new Set(rows.map((r) => r.listingId));
}
