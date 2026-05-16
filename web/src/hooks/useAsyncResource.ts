import { useCallback, useEffect, useRef, useState, type DependencyList } from "react";

export type UseAsyncResourceResult<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
};

/**
 * Small hook that abstracts the loading/error/data triplet for an async fetch.
 *
 * - Aborts the in-flight request when deps change or the component unmounts.
 * - Ignores resolved/rejected results after unmount via a mounted flag.
 * - `reload()` re-runs the fetcher with the current deps.
 *
 * Callers should treat AbortError as a non-error (it is suppressed here).
 */
export function useAsyncResource<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  deps: DependencyList
): UseAsyncResourceResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    const controller = new AbortController();
    let mounted = true;
    setLoading(true);
    setError(null);

    fetcherRef
      .current(controller.signal)
      .then((value) => {
        if (!mounted || controller.signal.aborted) return;
        setData(value);
      })
      .catch((err) => {
        if (!mounted || controller.signal.aborted) return;
        if (err && (err as { name?: string }).name === "AbortError") return;
        console.error(err);
        setData(null);
        setError(err instanceof Error ? err.message : "Request failed");
      })
      .finally(() => {
        if (!mounted || controller.signal.aborted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, reloadKey]);

  const reload = useCallback(() => {
    setReloadKey((value) => value + 1);
  }, []);

  return { data, loading, error, reload };
}
