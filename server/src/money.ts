/**
 * Every coin amount in this codebase is an integer in MINOR units.
 * 1 coin = 100 minor units, exactly like dollars and cents.
 *
 * The economics below are the product's revenue model, and they are all levers:
 *
 *   Buying coins:  $1.00 buys 1 coin, and larger packs come with bonus coins.
 *   Selling goods: the seller keeps 100% of the coins (PLATFORM_FEE_BPS = 0).
 *                  "0% seller fees" is the reason to use coins at all.
 *   Cashing out:   1 coin pays out $0.85.
 *
 * So the platform earns on the spread, not on the sale. A user who puts in $100
 * gets 108 coins; if every one of those coins is eventually cashed out we pay
 * $91.80 and keep $8.20 gross (~8%), out of which Stripe takes roughly half.
 * Coins that keep circulating inside the market never cost us the spread at all,
 * which is why "spend your earnings here" is worth pushing in the UI.
 */

export const COIN = 100;

export const TOPUP_RATE_USD_CENTS_PER_COIN = 100;
export const PAYOUT_RATE_USD_CENTS_PER_COIN = 85;

/** Platform cut on a sale, in basis points. 0 = sellers keep everything. */
export const PLATFORM_FEE_BPS = 0;

/** Don't let people cash out $2 at a time — Stripe's per-transfer cost eats it. */
export const MIN_PAYOUT_COINS = 20 * COIN;

export type TopUpPack = {
  id: string;
  usdCents: number;
  coins: number;
  bonusCoins: number;
};

export const TOPUP_PACKS: TopUpPack[] = [
  { id: "pack_10", usdCents: 1_000, coins: 10 * COIN, bonusCoins: 0 },
  { id: "pack_25", usdCents: 2_500, coins: 25 * COIN, bonusCoins: 1 * COIN },
  { id: "pack_50", usdCents: 5_000, coins: 50 * COIN, bonusCoins: 3 * COIN },
  { id: "pack_100", usdCents: 10_000, coins: 100 * COIN, bonusCoins: 8 * COIN },
];

export function findPack(id: string): TopUpPack | undefined {
  return TOPUP_PACKS.find((p) => p.id === id);
}

/** Platform cut for a sale of `amountCoins`, rounded down to whole minor units. */
export function feeFor(amountCoins: number): number {
  return Math.floor((amountCoins * PLATFORM_FEE_BPS) / 10_000);
}

/** What a seller actually receives in USD cents for burning `coins`. */
export function payoutUsdCents(coins: number): number {
  return Math.floor((coins * PAYOUT_RATE_USD_CENTS_PER_COIN) / COIN);
}

/** "2500" -> "25.00". Display only; never feed the result back into arithmetic. */
export function formatCoins(minor: number): string {
  return (minor / COIN).toFixed(2);
}
