import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../auth.js";
import { env } from "../env.js";
import { badRequest, handler, parse } from "../http.js";

export const uploadsRouter = Router();

export const UPLOAD_DIR = path.resolve(process.cwd(), "uploads");

const MAX_BYTES = 6 * 1024 * 1024;
const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
};

/**
 * Photo upload, base64 over JSON.
 *
 * Deliberately dumb: files land on local disk and are served straight back from
 * /uploads. It keeps the base dependency-free and works offline. Swapping in S3
 * or Cloudinary later means changing only this file — everything downstream just
 * stores a URL string.
 */
uploadsRouter.post(
  "/",
  requireAuth,
  handler(async (req, res) => {
    const { dataUrl } = parse(
      z.object({ dataUrl: z.string().startsWith("data:", "Expected a data: URL") }),
      req.body,
    );

    const match = /^data:([^;,]+);base64,(.+)$/s.exec(dataUrl);
    if (!match) throw badRequest("Expected a base64 data: URL");

    const [, mime, base64] = match as unknown as [string, string, string];
    const extension = EXTENSIONS[mime];
    if (!extension) throw badRequest(`Unsupported image type ${mime}`);

    const bytes = Buffer.from(base64, "base64");
    if (bytes.byteLength === 0) throw badRequest("Empty image");
    if (bytes.byteLength > MAX_BYTES) throw badRequest("Image is larger than 6 MB");

    const filename = `${randomUUID()}.${extension}`;
    await mkdir(UPLOAD_DIR, { recursive: true });
    await writeFile(path.join(UPLOAD_DIR, filename), bytes);

    res.status(201).json({ url: `${env.publicUrl}/uploads/${filename}` });
  }),
);
