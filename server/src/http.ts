import type { NextFunction, Request, RequestHandler, Response } from "express";
import { ZodError, type ZodTypeAny, type z } from "zod";

/** An error we deliberately surface to the client with a specific status code. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
  ) {
    super(message);
  }
}

export const badRequest = (m: string, code?: string) => new ApiError(400, m, code);
export const unauthorized = (m = "Not signed in") => new ApiError(401, m);
export const forbidden = (m = "Not allowed") => new ApiError(403, m);
export const notFound = (m = "Not found") => new ApiError(404, m);
export const conflict = (m: string, code?: string) => new ApiError(409, m, code);

/**
 * Express 5 forwards rejected promises to the error handler on its own, but only
 * for handlers it recognises as async. Wrapping keeps that behaviour explicit and
 * survives a downgrade to Express 4.
 */
export function handler(
  fn: (req: Request, res: Response) => Promise<unknown> | unknown,
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res)).catch(next);
  };
}

/** Parse `data` with `schema`, turning validation failures into a 400. */
export function parse<S extends ZodTypeAny>(schema: S, data: unknown): z.infer<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issue = result.error.issues[0];
    const path = issue.path.join(".");
    throw badRequest(path ? `${path}: ${issue.message}` : issue.message, "validation");
  }
  return result.data;
}

/**
 * Read a route parameter as a string.
 *
 * Express 5 types `req.params[x]` as `string | string[]`, because a route can
 * declare a repeated segment. Ours never do, so this narrows it in one place
 * instead of casting at every call site.
 */
export function param(req: Request, name: string): string {
  const value = req.params[name];
  const single = Array.isArray(value) ? value[0] : value;
  if (typeof single !== "string" || single.length === 0) {
    throw badRequest(`Missing ${name} in the URL`);
  }
  return single;
}

export function errorMiddleware(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof ApiError) {
    res.status(err.status).json({ error: err.message, code: err.code });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({ error: err.issues[0]?.message ?? "Invalid request" });
    return;
  }
  console.error("[unhandled]", err);
  res.status(500).json({ error: "Something went wrong on our end" });
}
