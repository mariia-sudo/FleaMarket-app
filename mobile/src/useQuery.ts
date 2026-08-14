import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "./api";

/**
 * The smallest thing that counts as data fetching: run `fn`, expose
 * {data, error, loading, reload}, and re-run when the screen regains focus.
 *
 * Deliberately not React Query — a base app shouldn't take on a cache library
 * before it has a caching problem. Swap it in later; every screen already goes
 * through this one hook.
 */
export function useQuery<T>(
  fn: () => Promise<T>,
  deps: unknown[] = [],
  options: { refetchOnFocus?: boolean } = {},
) {
  const { refetchOnFocus = true } = options;

  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Keeps the latest fn without making it a dependency of the effect.
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const run = useCallback(async (showSpinner: boolean) => {
    if (showSpinner) setLoading(true);
    try {
      const result = await fnRef.current();
      setData(result);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void run(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useFocusEffect(
    useCallback(() => {
      // Silent on focus: a spinner every time you switch tabs reads as jank.
      if (refetchOnFocus) void run(false);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [refetchOnFocus, run]),
  );

  const reload = useCallback(() => run(false), [run]);

  return { data, error, loading, reload, setData };
}
