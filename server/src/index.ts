import cors from "cors";
import express from "express";
import { env } from "./env.js";
import { errorMiddleware, notFound } from "./http.js";
import { authRouter } from "./routes/auth.js";
import { chatRouter } from "./routes/chat.js";
import { listingsRouter } from "./routes/listings.js";
import { ordersRouter } from "./routes/orders.js";
import { stripeWebhookRouter } from "./routes/stripeWebhook.js";
import { UPLOAD_DIR, uploadsRouter } from "./routes/uploads.js";
import { walletRouter } from "./routes/wallet.js";
import { stripeEnabled } from "./stripe.js";
import { CATEGORIES, CONDITIONS } from "./types.js";

const app = express();

app.use(cors());

// The Stripe webhook needs the raw request body for signature verification, so it
// has to be mounted before express.json() gets a chance to consume the stream.
app.use("/stripe", stripeWebhookRouter);

// Generous limit because photos arrive as base64 data URLs (see routes/uploads.ts).
app.use(express.json({ limit: "12mb" }));

app.use("/uploads", express.static(UPLOAD_DIR, { maxAge: "7d" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, sandbox: !stripeEnabled });
});

// Lets the client render pickers without hardcoding the same lists twice.
app.get("/meta", (_req, res) => {
  res.json({ categories: CATEGORIES, conditions: CONDITIONS });
});

app.use("/auth", authRouter);
app.use("/listings", listingsRouter);
app.use("/orders", ordersRouter);
app.use("/wallet", walletRouter);
app.use("/chat", chatRouter);
app.use("/uploads", uploadsRouter);

app.use((_req, _res, next) => next(notFound("No such endpoint")));
app.use(errorMiddleware);

app.listen(env.port, () => {
  console.log(`FleaMarket API on http://localhost:${env.port}`);
  if (!stripeEnabled) {
    console.log("Stripe not configured — wallet is running in SANDBOX mode.");
  }
});
