import { Router } from "express";
import { z } from "zod";
import { currentUserId, hashPassword, requireAuth, signToken, verifyPassword } from "../auth.js";
import { prisma } from "../db.js";
import { conflict, handler, parse, unauthorized } from "../http.js";
import { userAccount, userBalance } from "../ledger.js";
import { privateUser } from "../serialize.js";

export const authRouter = Router();

const credentials = z.object({
  email: z.string().email().transform((s) => s.trim().toLowerCase()),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const signUpBody = credentials.extend({
  displayName: z.string().min(2).max(40).transform((s) => s.trim()),
  city: z.string().max(60).optional(),
  state: z.string().length(2).optional(),
  zip: z.string().max(10).optional(),
});

authRouter.post(
  "/signup",
  handler(async (req, res) => {
    const body = parse(signUpBody, req.body);

    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) throw conflict("That email is already registered", "email_taken");

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: body.email,
          passwordHash: await hashPassword(body.password),
          displayName: body.displayName,
          city: body.city,
          state: body.state?.toUpperCase(),
          zip: body.zip,
        },
      });
      // Open the wallet immediately so the balance endpoint has something to read.
      await userAccount(tx, created.id);
      return created;
    });

    res.status(201).json({
      token: signToken(user.id),
      user: { ...privateUser(user), balanceCoins: 0 },
    });
  }),
);

authRouter.post(
  "/login",
  handler(async (req, res) => {
    const body = parse(credentials, req.body);

    const user = await prisma.user.findUnique({ where: { email: body.email } });
    // Same message either way — don't let anyone probe which emails exist.
    if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
      throw unauthorized("Wrong email or password");
    }

    const balanceCoins = await userBalance(prisma, user.id);
    res.json({ token: signToken(user.id), user: { ...privateUser(user), balanceCoins } });
  }),
);

authRouter.get(
  "/me",
  requireAuth,
  handler(async (req, res) => {
    const userId = currentUserId(req);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const balanceCoins = await userBalance(prisma, userId);
    res.json({ user: { ...privateUser(user), balanceCoins } });
  }),
);

const profileBody = z.object({
  displayName: z.string().min(2).max(40).optional(),
  bio: z.string().max(300).optional(),
  avatarUrl: z.string().url().optional(),
  city: z.string().max(60).optional(),
  state: z.string().length(2).optional(),
  zip: z.string().max(10).optional(),
});

authRouter.patch(
  "/me",
  requireAuth,
  handler(async (req, res) => {
    const userId = currentUserId(req);
    const body = parse(profileBody, req.body);
    const user = await prisma.user.update({
      where: { id: userId },
      data: { ...body, state: body.state?.toUpperCase() },
    });
    const balanceCoins = await userBalance(prisma, userId);
    res.json({ user: { ...privateUser(user), balanceCoins } });
  }),
);
