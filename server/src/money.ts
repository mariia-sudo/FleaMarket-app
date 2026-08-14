/**
 * Every coin amount in this codebase is an integer in MINOR units.
 * 1 coin = 100 minor units, exactly like dollars and cents.
 *
 * The economics below are the product's revenue model, and they are all levers:
 *
 *   Buying coins:  $1.00 buys 1 coin.
 *   Selling goods: the seller keeps 100% of the coins (PLATFORM_FEE_BPS = 0).
 *   Cashing out:   1 coin pays out $0.92, so a seller who converts to dollars
 *                  gives up 8% — and one who spends the coins here gives up
 *                  nothing at all.
 *
 * Do not call this "0% seller fees". A seller who cashes out pays 8%, and
 * anyone who does the arithmetic will notice. The honest claim is "you pay only
 * when you take money out", which is also the claim that makes the incentive to
 * keep coins circulating obvious.
 *
 * Why 8%: our competitors on *local pickup* — Facebook Marketplace, OfferUp,
 * Craigslist — charge nothing, because they don't touch the payment at all.
 * What they also don't do is hold the money until the buyer has the item. The
 * shipping marketplaces do take a cut: Poshmark 20%, eBay ~13.6%, OfferUp 12.9%,
 * Mercari 10%, Depop 0% + 3.3% processing (checked August 2026). 8% has to sit
 * below the ones that charge and be worth it against the ones that don't.
 *
 * Margin check on $100 topped up and later fully cashed out:
 *   in   $100.00  − Stripe (2.9% + $0.30) = $96.80
 *   out  $92.00  + payout cost ~$0.25     = $92.25
 *   kept  ~$4.55, about 4.5%.
 *
 * That margin is thin enough that bonus coins had to go: every bonus coin is
 * paid for out of it. Reintroducing a 5% bonus would cost roughly the whole
 * thing. Coins that never get cashed out cost us nothing, which is the part of
 * the model worth designing the product around.
 */

export const COIN = 100;

export const TOPUP_RATE_USD_CENTS_PER_COIN = 100;
export const PAYOUT_RATE_USD_CENTS_PER_COIN = 92;

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

// Straight $1 = 1 coin, no bonuses — see the margin note above. `bonusCoins` is
// kept in the shape because the ledger and the wallet screen already handle it,
// so a promotion is a number change rather than a schema change.
export const TOPUP_PACKS: TopUpPack[] = [
  { id: "pack_10", usdCents: 1_000, coins: 10 * COIN, bonusCoins: 0 },
  { id: "pack_25", usdCents: 2_500, coins: 25 * COIN, bonusCoins: 0 },
  { id: "pack_50", usdCents: 5_000, coins: 50 * COIN, bonusCoins: 0 },
  { id: "pack_100", usdCents: 10_000, coins: 100 * COIN, bonusCoins: 0 },
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
