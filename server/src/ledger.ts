import type { Tx } from "./db.js";
import { badRequest, conflict } from "./http.js";
import type { AccountKind, TxKind } from "./types.js";

/**
 * Double-entry ledger.
 *
 * Nothing in this codebase writes a balance column. A balance is always the sum
 * of an account's entries, and every movement is a transaction whose entries sum
 * to zero. That invariant is what lets us answer "where did my coins go" a year
 * from now, and it is checked on every write rather than trusted.
 *
 * All amounts are minor coin units (see money.ts).
 */

export type EntryInput = { accountId: string; delta: number };

/**
 * Resolve the ledger account for a user, creating it on first use.
 * Every user has exactly one USER_AVAILABLE account.
 *
 * Upsert rather than find-then-create: two simultaneous first actions by the
 * same user would otherwise race to create two accounts, and a user with two
 * wallets is a user whose balance depends on which one you look at.
 */
export async function userAccount(tx: Tx, userId: string): Promise<string> {
  const kind: AccountKind = "USER_AVAILABLE";
  const account = await tx.account.upsert({
    where: { kind_userId: { kind, userId } },
    create: { kind, userId },
    update: {},
  });
  return account.id;
}

/**
 * Resolve a platform-owned account. These are singletons and are allowed to hold
 * a negative balance: SYSTEM_MINT sitting at -50000 means 500 coins exist.
 *
 * Their primary key is the kind itself. The @@unique([kind, userId]) constraint
 * can't protect them — SQL treats NULLs as distinct, so it would happily allow
 * two SYSTEM_ESCROW rows — but a fixed id makes duplicates impossible.
 */
export async function systemAccount(tx: Tx, kind: AccountKind): Promise<string> {
  if (!kind.startsWith("SYSTEM_")) {
    throw new Error(`systemAccount called with user account kind ${kind}`);
  }
  const account = await tx.account.upsert({
    where: { id: kind },
    create: { id: kind, kind, userId: null },
    update: {},
  });
  return account.id;
}

export async function balanceOf(tx: Tx, accountId: string): Promise<number> {
  const result = await tx.ledgerEntry.aggregate({
    where: { accountId },
    _sum: { delta: true },
  });
  return result._sum.delta ?? 0;
}

/** Spendable coin balance for a user. Returns 0 for a user who never had an account. */
export async function userBalance(tx: Tx, userId: string): Promise<number> {
  const account = await tx.account.findFirst({
    where: { kind: "USER_AVAILABLE", userId },
  });
  if (!account) return 0;
  return balanceOf(tx, account.id);
}

/**
 * Write one balanced transaction.
 *
 * Refuses to post if the entries don't net to zero, and refuses to leave any
 * *user* account negative — a bug in a route should surface as a failed request,
 * never as invented coins.
 *
 * Must be called inside `prisma.$transaction`.
 */
export async function postTx(
  tx: Tx,
  input: {
    kind: TxKind;
    entries: EntryInput[];
    reference?: string;
    memo?: string;
  },
): Promise<string> {
  const { kind, entries, reference, memo } = input;

  if (entries.length < 2) {
    throw new Error(`Ledger tx ${kind} needs at least two entries`);
  }
  if (entries.some((e) => !Number.isInteger(e.delta))) {
    throw new Error(`Ledger tx ${kind} has a non-integer delta`);
  }
  const net = entries.reduce((sum, e) => sum + e.delta, 0);
  if (net !== 0) {
    throw new Error(`Ledger tx ${kind} does not balance: net ${net}`);
  }

  const debited = [...new Set(entries.filter((e) => e.delta < 0).map((e) => e.accountId))];

  // Lock every account we're taking coins out of, BEFORE writing anything.
  //
  // Without this, two purchases racing on the same wallet each read a healthy
  // balance, each decide there's enough, and both commit — the buyer spends the
  // same coins twice. Postgres only shows a transaction its own uncommitted
  // rows, so summing entries is not enough on its own.
  //
  // Sorted by id so that two transactions touching the same pair of accounts
  // always grab the locks in the same order, which is what stops them
  // deadlocking against each other.
  for (const accountId of [...debited].sort()) {
    await tx.$queryRaw`SELECT id FROM "Account" WHERE id = ${accountId} FOR UPDATE`;
  }

  const ledgerTx = await tx.ledgerTx.create({
    data: { kind, reference, memo },
  });

  for (const entry of entries) {
    await tx.ledgerEntry.create({
      data: { txId: ledgerTx.id, accountId: entry.accountId, delta: entry.delta },
    });
  }

  // Verify after the fact rather than before: this way the check accounts for
  // everything else committed in the same transaction.
  for (const accountId of debited) {
    const account = await tx.account.findUniqueOrThrow({ where: { id: accountId } });
    if (account.kind !== "USER_AVAILABLE") continue;
    const balance = await balanceOf(tx, accountId);
    if (balance < 0) {
      throw conflict("Not enough coins", "insufficient_funds");
    }
  }

  return ledgerTx.id;
}

/** Guard used by routes before they start building entries, for a clearer error. */
export function assertPositive(amount: number, what = "amount"): number {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw badRequest(`${what} must be a positive whole number of coin units`);
  }
  return amount;
}

/** A user's coin history, newest first, as flat rows the app can render directly. */
export async function historyFor(tx: Tx, userId: string, limit = 50) {
  const account = await tx.account.findFirst({
    where: { kind: "USER_AVAILABLE", userId },
  });
  if (!account) return [];

  const entries = await tx.ledgerEntry.findMany({
    where: { accountId: account.id },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { tx: true },
  });

  return entries.map((entry) => ({
    id: entry.id,
    delta: entry.delta,
    kind: entry.tx.kind,
    memo: entry.tx.memo,
    reference: entry.tx.reference,
    createdAt: entry.createdAt,
  }));
}
