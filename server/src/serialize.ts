import type { Listing, ListingPhoto, Order, User } from "@prisma/client";

/** What we're willing to show about another user. Never leaks passwordHash or email. */
export function publicUser(user: User) {
  return {
    id: user.id,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    city: user.city,
    state: user.state,
    createdAt: user.createdAt,
  };
}

/** The extra fields a user is allowed to see about themselves. */
export function privateUser(user: User) {
  return {
    ...publicUser(user),
    email: user.email,
    zip: user.zip,
    payoutsEnabled: user.payoutsEnabled,
    hasStripeAccount: Boolean(user.stripeAccountId),
  };
}

type ListingWithRelations = Listing & {
  photos: ListingPhoto[];
  seller: User;
};

export function publicListing(
  listing: ListingWithRelations,
  opts: { favorited?: boolean } = {},
) {
  return {
    id: listing.id,
    title: listing.title,
    description: listing.description,
    priceCoins: listing.priceCoins,
    category: listing.category,
    condition: listing.condition,
    status: listing.status,
    city: listing.city,
    state: listing.state,
    createdAt: listing.createdAt,
    photos: [...listing.photos]
      .sort((a, b) => a.position - b.position)
      .map((p) => ({ id: p.id, url: p.url })),
    seller: publicUser(listing.seller),
    favorited: opts.favorited ?? false,
  };
}

type OrderWithRelations = Order & {
  listing: Listing & { photos: ListingPhoto[] };
  buyer: User;
  seller: User;
};

export function publicOrder(order: OrderWithRelations) {
  const cover = [...order.listing.photos].sort((a, b) => a.position - b.position)[0];
  return {
    id: order.id,
    status: order.status,
    amountCoins: order.amountCoins,
    feeCoins: order.feeCoins,
    createdAt: order.createdAt,
    completedAt: order.completedAt,
    listing: {
      id: order.listing.id,
      title: order.listing.title,
      coverUrl: cover?.url ?? null,
    },
    buyer: publicUser(order.buyer),
    seller: publicUser(order.seller),
  };
}
