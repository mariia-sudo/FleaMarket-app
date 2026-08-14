import Constants from "expo-constants";
import { Platform } from "react-native";

/**
 * Where the API lives.
 *
 * On a simulator localhost works. On a physical phone it does not — the phone
 * needs your Mac's LAN address, which Expo already knows because that's how it
 * served the bundle. We reuse that host and swap in the API port.
 */
function resolveBaseUrl(): string {
  const override = process.env.EXPO_PUBLIC_API_URL;
  if (override) return override;

  const hostUri = Constants.expoConfig?.hostUri ?? Constants.expoGoConfig?.debuggerHost;
  const lanHost = hostUri?.split(":")[0];
  if (lanHost && lanHost !== "localhost" && lanHost !== "127.0.0.1") {
    return `http://${lanHost}:4000`;
  }

  // Android emulators reach the host machine through this special address.
  return Platform.OS === "android" ? "http://10.0.2.2:4000" : "http://localhost:4000";
}

export const API_URL = resolveBaseUrl();

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
  ) {
    super(message);
  }
}

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | undefined>;
};

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, query } = options;

  const url = new URL(`${API_URL}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
    }
  }

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method,
      headers: {
        ...(body ? { "content-type": "application/json" } : {}),
        ...(authToken ? { authorization: `Bearer ${authToken}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    // Almost always "the server isn't running" during development, so say that
    // rather than surfacing a bare TypeError.
    throw new ApiError(0, `Can't reach the server at ${API_URL}`, "network");
  }

  const text = await response.text();
  const payload = text ? (JSON.parse(text) as Record<string, unknown>) : {};

  if (!response.ok) {
    throw new ApiError(
      response.status,
      typeof payload.error === "string" ? payload.error : "Something went wrong",
      typeof payload.code === "string" ? payload.code : undefined,
    );
  }

  return payload as T;
}

// --- Shared response shapes -------------------------------------------------

export type PublicUser = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  city: string | null;
  state: string | null;
  createdAt: string;
};

export type Me = PublicUser & {
  email: string;
  zip: string | null;
  payoutsEnabled: boolean;
  hasStripeAccount: boolean;
  balanceCoins: number;
};

export type Listing = {
  id: string;
  title: string;
  description: string;
  priceCoins: number;
  category: string;
  condition: "NEW" | "LIKE_NEW" | "GOOD" | "FAIR";
  status: "ACTIVE" | "RESERVED" | "SOLD" | "REMOVED";
  city: string | null;
  state: string | null;
  createdAt: string;
  photos: { id: string; url: string }[];
  seller: PublicUser;
  favorited: boolean;
};

export type Order = {
  id: string;
  status: "ESCROW" | "COMPLETED" | "CANCELLED";
  amountCoins: number;
  feeCoins: number;
  createdAt: string;
  completedAt: string | null;
  listing: { id: string; title: string; coverUrl: string | null };
  buyer: PublicUser;
  seller: PublicUser;
};

export type Wallet = {
  balanceCoins: number;
  packs: { id: string; usdCents: number; coins: number; bonusCoins: number }[];
  rates: {
    coinMinorUnits: number;
    topUpUsdCentsPerCoin: number;
    payoutUsdCentsPerCoin: number;
    minPayoutCoins: number;
  };
  payouts: { enabled: boolean; onboardingStarted: boolean; availableUsdCents: number };
  sandbox: boolean;
};

export type LedgerEntry = {
  id: string;
  delta: number;
  kind: "TOPUP" | "PURCHASE" | "RELEASE" | "REFUND" | "PAYOUT" | "BONUS";
  memo: string | null;
  reference: string | null;
  createdAt: string;
};

export type ThreadSummary = {
  id: string;
  lastMessageAt: string;
  lastMessage: string | null;
  counterparty: PublicUser;
  role: "buying" | "selling";
  listing: {
    id: string;
    title: string;
    priceCoins: number;
    status: string;
    coverUrl: string | null;
  };
};

export type ChatMessage = {
  id: string;
  body: string;
  createdAt: string;
  mine: boolean;
};

// --- Endpoints --------------------------------------------------------------

export const api = {
  signUp: (body: {
    email: string;
    password: string;
    displayName: string;
    city?: string;
    state?: string;
    zip?: string;
  }) => request<{ token: string; user: Me }>("/auth/signup", { method: "POST", body }),

  logIn: (body: { email: string; password: string }) =>
    request<{ token: string; user: Me }>("/auth/login", { method: "POST", body }),

  me: () => request<{ user: Me }>("/auth/me"),

  updateProfile: (body: Partial<Pick<Me, "displayName" | "bio" | "city" | "state" | "zip">>) =>
    request<{ user: Me }>("/auth/me", { method: "PATCH", body }),

  listings: (query: {
    q?: string;
    category?: string;
    cursor?: string;
    sellerId?: string;
    limit?: number;
  }) => request<{ listings: Listing[]; nextCursor: string | null }>("/listings", { query }),

  listing: (id: string) => request<{ listing: Listing }>(`/listings/${id}`),

  favorites: () => request<{ listings: Listing[] }>("/listings/favorites"),

  toggleFavorite: (id: string) =>
    request<{ favorited: boolean }>(`/listings/${id}/favorite`, { method: "POST" }),

  createListing: (body: {
    title: string;
    description: string;
    priceCoins: number;
    category: string;
    condition: string;
    photoUrls: string[];
  }) => request<{ listing: Listing }>("/listings", { method: "POST", body }),

  removeListing: (id: string) => request<{ ok: true }>(`/listings/${id}`, { method: "DELETE" }),

  upload: (dataUrl: string) =>
    request<{ url: string }>("/uploads", { method: "POST", body: { dataUrl } }),

  buy: (listingId: string) =>
    request<{ order: Order }>("/orders", { method: "POST", body: { listingId } }),

  orders: (role: "buying" | "selling" | "all" = "all") =>
    request<{ orders: Order[] }>("/orders", { query: { role } }),

  order: (id: string) => request<{ order: Order }>(`/orders/${id}`),

  confirmOrder: (id: string) =>
    request<{ order: Order }>(`/orders/${id}/confirm`, { method: "POST" }),

  cancelOrder: (id: string) =>
    request<{ order: Order }>(`/orders/${id}/cancel`, { method: "POST" }),

  wallet: () => request<Wallet>("/wallet"),

  walletHistory: () => request<{ entries: LedgerEntry[] }>("/wallet/history"),

  topUp: (packId: string) =>
    request<{ sandbox: boolean; topUpId: string; checkoutUrl?: string; balanceCoins?: number }>(
      "/wallet/topup",
      { method: "POST", body: { packId } },
    ),

  connectPayouts: () =>
    request<{ sandbox: boolean; onboardingUrl?: string; payoutsEnabled?: boolean }>(
      "/wallet/connect",
      { method: "POST" },
    ),

  cashOut: (coins: number) =>
    request<{ payout: { coins: number; usdCents: number; status: string }; balanceCoins: number }>(
      "/wallet/payout",
      { method: "POST", body: { coins } },
    ),

  openThread: (listingId: string) =>
    request<{ threadId: string }>("/chat/threads", { method: "POST", body: { listingId } }),

  threads: () => request<{ threads: ThreadSummary[] }>("/chat/threads"),

  messages: (threadId: string) =>
    request<{ messages: ChatMessage[] }>(`/chat/threads/${threadId}/messages`),

  sendMessage: (threadId: string, body: string) =>
    request<{ message: ChatMessage }>(`/chat/threads/${threadId}/messages`, {
      method: "POST",
      body: { body },
    }),

  meta: () => request<{ categories: string[]; conditions: string[] }>("/meta"),
};
