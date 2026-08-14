// String columns in schema.prisma are typed here. Keep the two in sync.

export const CATEGORIES = [
  "furniture",
  "electronics",
  "clothing",
  "home",
  "kids",
  "sports",
  "books",
  "tools",
  "garden",
  "other",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const CONDITIONS = ["NEW", "LIKE_NEW", "GOOD", "FAIR"] as const;
export type Condition = (typeof CONDITIONS)[number];

export const LISTING_STATUSES = ["ACTIVE", "RESERVED", "SOLD", "REMOVED"] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

export const ORDER_STATUSES = ["ESCROW", "COMPLETED", "CANCELLED"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ACCOUNT_KINDS = [
  "USER_AVAILABLE",
  "SYSTEM_MINT",
  "SYSTEM_ESCROW",
  "SYSTEM_FEE",
  "SYSTEM_PAYOUT",
] as const;
export type AccountKind = (typeof ACCOUNT_KINDS)[number];

export const TX_KINDS = [
  "TOPUP",
  "PURCHASE",
  "RELEASE",
  "REFUND",
  "PAYOUT",
  "BONUS",
] as const;
export type TxKind = (typeof TX_KINDS)[number];
