import { prisma } from "../src/db.js";
import { COIN, formatCoins } from "../src/money.js";

/**
 * Ledger audit — `npm run audit`.
 *
 * Prints every account balance and checks the one invariant the whole currency
 * rests on: the sum of every entry in the system is exactly zero. If it isn't,
 * coins were created or destroyed outside a balanced transaction, and that is a
 * bug worth stopping everything for.
 *
 * Run it after any change to ledger.ts, and on a schedule in production.
 */

async function main() {
  const accounts = await prisma.account.findMany({
    include: { user: true },
    orderBy: [{ kind: "asc" }],
  });

  const rows: { label: string; balance: number }[] = [];
  for (const account of accounts) {
    const sum = await prisma.ledgerEntry.aggregate({
      where: { accountId: account.id },
      _sum: { delta: true },
    });
    rows.push({
      label: account.user ? `${account.user.displayName} (wallet)` : account.kind,
      balance: sum._sum.delta ?? 0,
    });
  }

  const width = Math.max(...rows.map((r) => r.label.length), 20);
  for (const row of rows) {
    console.log(`  ${row.label.padEnd(width)} ${formatCoins(row.balance).padStart(12)}`);
  }

  const total = rows.reduce((sum, r) => sum + r.balance, 0);
  console.log(`  ${"-".repeat(width + 13)}`);
  console.log(`  ${"TOTAL".padEnd(width)} ${formatCoins(total).padStart(12)}`);

  // SYSTEM_MINT is negative by exactly the number of coins that exist.
  const mint = rows.find((r) => r.label === "SYSTEM_MINT")?.balance ?? 0;
  const burned = rows.find((r) => r.label === "SYSTEM_PAYOUT")?.balance ?? 0;
  console.log(`\n  Coins ever issued:   ${formatCoins(-mint)}`);
  console.log(`  Coins cashed out:    ${formatCoins(burned)}`);
  console.log(`  In circulation:      ${formatCoins(-mint - burned)}`);

  if (total !== 0) {
    console.error(`\n  ✗ LEDGER DOES NOT BALANCE — off by ${total / COIN} coins`);
    process.exitCode = 1;
    return;
  }
  console.log("\n  ✓ Ledger balances.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
