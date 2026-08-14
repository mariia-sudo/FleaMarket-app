import "dotenv/config";

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) throw new Error(`Missing required env var ${name}`);
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),

  // In development we fall back to a throwaway secret so the app boots with zero
  // configuration. In production the process must refuse to start without one.
  jwtSecret:
    process.env.NODE_ENV === "production"
      ? required("JWT_SECRET")
      : process.env.JWT_SECRET ?? "dev-only-insecure-secret",

  // Stripe is optional locally: without keys the wallet still works end to end in
  // "sandbox mode", where a top-up credits coins immediately instead of going
  // through Checkout. See routes/wallet.ts.
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",

  // Where Stripe sends the user back after Checkout / Connect onboarding.
  publicUrl: process.env.PUBLIC_URL ?? "http://localhost:4000",
  appScheme: process.env.APP_SCHEME ?? "fleamarket",
} as const;

export const stripeEnabled = env.stripeSecretKey.length > 0;
