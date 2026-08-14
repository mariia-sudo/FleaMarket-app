/**
 * Coin formatting. Mirrors server/src/money.ts — amounts crossing the wire are
 * always integers in minor units (1 coin = 100), never decimals.
 */

export const COIN = 100;

/** 2500 -> "25", 2550 -> "25.50". Whole amounts drop the cents for a calmer feed. */
export function formatCoins(minor: number): string {
  const value = minor / COIN;
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

/** Parse what a seller typed into the price field. "25.50" -> 2550. */
export function parseCoins(input: string): number | null {
  const cleaned = input.replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * COIN);
}

export function formatUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function formatDate(iso: string): string {
  const date = new Date(iso);
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}
