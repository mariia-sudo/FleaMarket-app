import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();

/** The transaction-scoped client Prisma hands to `prisma.$transaction(async (tx) => ...)`. */
export type Tx = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;
