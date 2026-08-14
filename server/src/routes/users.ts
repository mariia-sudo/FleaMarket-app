import { Router } from "express";
import { optionalAuth } from "../auth.js";
import { prisma } from "../db.js";
import { handler, notFound, param } from "../http.js";
import { publicListing, publicUser } from "../serialize.js";

export const usersRouter = Router();

/**
 * Public seller profile.
 *
 * Everything here is either public by nature (their listings) or earned from
 * real trades (reviews, completed sales). Note what is absent: no email, no zip,
 * no street address — location stops at city and state, because the point of a
 * local marketplace profile is "roughly where do I go to pick this up", not
 * "where does this person live".
 */
usersRouter.get(
  "/:id",
  optionalAuth,
  handler(async (req, res) => {
    const id = param(req, "id");

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw notFound("Profile not found");

    const [listings, completedSales, completedPurchases, reviews, ratingAgg] =
      await Promise.all([
        prisma.listing.findMany({
          where: { sellerId: id, status: "ACTIVE" },
          include: { photos: true, seller: true },
          orderBy: { createdAt: "desc" },
          take: 30,
        }),
        prisma.order.count({ where: { sellerId: id, status: "COMPLETED" } }),
        prisma.order.count({ where: { buyerId: id, status: "COMPLETED" } }),
        prisma.review.findMany({
          where: { subjectId: id },
          include: { author: true, order: { include: { listing: true } } },
          orderBy: { createdAt: "desc" },
          take: 50,
        }),
        prisma.review.aggregate({
          where: { subjectId: id },
          _avg: { rating: true },
          _count: { rating: true },
        }),
      ]);

    // Which listings this viewer has already favorited, so the hearts render right.
    const favorited = req.userId
      ? new Set(
          (
            await prisma.favorite.findMany({
              where: { userId: req.userId, listingId: { in: listings.map((l) => l.id) } },
              select: { listingId: true },
            })
          ).map((f) => f.listingId),
        )
      : new Set<string>();

    res.json({
      user: publicUser(user),
      stats: {
        activeListings: listings.length,
        completedSales,
        completedPurchases,
        // Rounded to one decimal — pretending to more precision than a handful of
        // ratings supports just looks silly.
        ratingAverage: ratingAgg._avg.rating
          ? Math.round(ratingAgg._avg.rating * 10) / 10
          : null,
        ratingCount: ratingAgg._count.rating,
      },
      listings: listings.map((l) => publicListing(l, { favorited: favorited.has(l.id) })),
      reviews: reviews.map((review) => ({
        id: review.id,
        rating: review.rating,
        body: review.body,
        createdAt: review.createdAt,
        author: publicUser(review.author),
        // Says whether this person was reviewed as the seller or the buyer in
        // that trade — "great buyer, showed up on time" is a different signal.
        role: review.order.sellerId === id ? "seller" : "buyer",
        listingTitle: review.order.listing.title,
      })),
    });
  }),
);
