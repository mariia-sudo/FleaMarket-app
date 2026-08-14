import * as SecureStore from "expo-secure-store";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api, setAuthToken, type Me } from "./api";

/**
 * Session state for the whole app.
 *
 * The token lives in the device keychain (expo-secure-store), not AsyncStorage —
 * it's a bearer credential, and AsyncStorage is plain text on disk.
 */

const TOKEN_KEY = "fleamarket.token";

type AuthValue = {
  user: Me | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: {
    email: string;
    password: string;
    displayName: string;
    city?: string;
    state?: string;
  }) => Promise<void>;
  signOut: () => Promise<void>;
  /** Re-reads the user (and their balance) after anything that moves coins. */
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore the session on cold start.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await SecureStore.getItemAsync(TOKEN_KEY);
        if (!token) return;
        setAuthToken(token);
        const { user: me } = await api.me();
        if (!cancelled) setUser(me);
      } catch {
        // Expired or invalid token — drop it and show the sign-in screen.
        await SecureStore.deleteItemAsync(TOKEN_KEY);
        setAuthToken(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const adopt = useCallback(async (token: string, me: Me) => {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    setAuthToken(token);
    setUser(me);
  }, []);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const { token, user: me } = await api.logIn({ email, password });
      await adopt(token, me);
    },
    [adopt],
  );

  const signUp = useCallback<AuthValue["signUp"]>(
    async (input) => {
      const { token, user: me } = await api.signUp(input);
      await adopt(token, me);
    },
    [adopt],
  );

  const signOut = useCallback(async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    setAuthToken(null);
    setUser(null);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const { user: me } = await api.me();
      setUser(me);
    } catch {
      // A failed refresh shouldn't log anyone out; the next action will retry.
    }
  }, []);

  const value = useMemo(
    () => ({ user, loading, signIn, signUp, signOut, refresh }),
    [user, loading, signIn, signUp, signOut, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside <AuthProvider>");
  return value;
}

/** Convenience for screens that are only reachable when signed in. */
export function useMe(): Me {
  const { user } = useAuth();
  if (!user) throw new Error("useMe used on a screen reachable while signed out");
  return user;
}
