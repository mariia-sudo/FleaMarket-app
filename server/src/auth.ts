import bcrypt from "bcryptjs";
import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "./env.js";
import { unauthorized } from "./http.js";

const TOKEN_TTL = "30d";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export const hashPassword = (plain: string) => bcrypt.hash(plain, 10);
export const verifyPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash);

export function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, env.jwtSecret, { expiresIn: TOKEN_TTL });
}

function readToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim() || null;
}

function verify(token: string): string | null {
  try {
    const payload = jwt.verify(token, env.jwtSecret);
    if (typeof payload === "string" || !payload.sub) return null;
    return String(payload.sub);
  } catch {
    return null;
  }
}

/** Rejects the request unless a valid token is present. */
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token = readToken(req);
  const userId = token && verify(token);
  if (!userId) return next(unauthorized());
  req.userId = userId;
  next();
}

/** Populates `req.userId` when a token is present, but lets anonymous through. */
export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const token = readToken(req);
  const userId = token && verify(token);
  if (userId) req.userId = userId;
  next();
}

export function currentUserId(req: Request): string {
  if (!req.userId) throw unauthorized();
  return req.userId;
}
