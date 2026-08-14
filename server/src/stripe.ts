import Stripe from "stripe";
import { env, stripeEnabled } from "./env.js";

/**
 * Stripe is optional in development. With no STRIPE_SECRET_KEY the wallet runs in
 * SANDBOX MODE: top-ups credit coins instantly and payouts are marked paid without
 * money moving. That keeps the whole app testable on a laptop, and the real path
 * is the same code with the key filled in.
 */
// No explicit apiVersion: pinning it here means every SDK bump becomes a type
// error. The account's default version in the Stripe dashboard is the source of
// truth instead.
export const stripe = stripeEnabled ? new Stripe(env.stripeSecretKey) : null;

export { stripeEnabled };

/**
 * Connect account for a seller who wants real dollars.
 *
 * This is the piece that keeps the product legal without our own money
 * transmitter licences: Stripe is the licensed party, it runs KYC on the seller,
 * and the payout is a Stripe transfer to their own connected account. We never
 * hold or move customer funds ourselves.
 */
export async function createConnectAccount(email: string): Promise<string> {
  if (!stripe) throw new Error("Stripe is not configured");
  const account = await stripe.accounts.create({
    type: "express",
    email,
    country: "US",
    capabilities: { transfers: { requested: true } },
    business_type: "individual",
  });
  return account.id;
}

export async function createOnboardingLink(accountId: string): Promise<string> {
  if (!stripe) throw new Error("Stripe is not configured");
  const link = await stripe.accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    refresh_url: `${env.publicUrl}/stripe/refresh`,
    return_url: `${env.publicUrl}/stripe/return`,
  });
  return link.url;
}
