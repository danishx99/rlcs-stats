import { useCallback, useEffect, useMemo } from "react";
import type { NavigateFunction } from "react-router-dom";
import type { SetURLSearchParams } from "react-router-dom";

export const STAT_SELECTION_CAP = 8;
const EXTRAS_PARAM = "stats";

type UseStatSelectionOptions = {
  statKey: string | undefined;
  searchParams: URLSearchParams;
  setSearchParams: SetURLSearchParams;
  navigate: NavigateFunction;
  validKeys: Set<string> | null;
};

type UseStatSelectionResult = {
  orderedStats: string[];
  toggleStat: (key: string) => void;
  removeStat: (key: string) => void;
  isAtCap: boolean;
  cap: number;
  count: number;
};

function parseExtras(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function serializeExtras(extras: string[]): string {
  return extras.join(",");
}

function buildSearchString(params: URLSearchParams): string {
  const str = params.toString();
  return str ? `?${str}` : "";
}

export function useStatSelection({
  statKey,
  searchParams,
  setSearchParams,
  navigate,
  validKeys,
}: UseStatSelectionOptions): UseStatSelectionResult {
  const rawExtras = searchParams.get(EXTRAS_PARAM);

  // Parse + dedupe + filter against anchor and (when known) validKeys.
  const orderedStats = useMemo(() => {
    if (!statKey) return [];
    const extras = parseExtras(rawExtras);
    const seen = new Set<string>();
    const out: string[] = [statKey];
    seen.add(statKey);
    for (const key of extras) {
      if (seen.has(key)) continue;
      if (validKeys && !validKeys.has(key)) continue;
      seen.add(key);
      out.push(key);
    }
    return out.slice(0, STAT_SELECTION_CAP);
  }, [statKey, rawExtras, validKeys]);

  // Canonicalize URL: drop unknown keys and empty `stats=` param.
  // Only runs once validKeys is known to avoid wiping unknowns prematurely.
  useEffect(() => {
    if (!statKey) return;
    if (!validKeys) return;
    const currentExtras = parseExtras(rawExtras);
    const seen = new Set<string>([statKey]);
    const canonical: string[] = [];
    for (const key of currentExtras) {
      if (seen.has(key)) continue;
      if (!validKeys.has(key)) continue;
      seen.add(key);
      canonical.push(key);
    }
    const cappedExtras = canonical.slice(0, STAT_SELECTION_CAP - 1);
    const nextValue = serializeExtras(cappedExtras);
    const currentValue = rawExtras ?? "";
    if (nextValue !== currentValue) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (nextValue) next.set(EXTRAS_PARAM, nextValue);
          else next.delete(EXTRAS_PARAM);
          return next;
        },
        { replace: true }
      );
    }
  }, [statKey, rawExtras, validKeys, setSearchParams]);

  const count = orderedStats.length;
  const isAtCap = count >= STAT_SELECTION_CAP;

  const setExtrasInParams = useCallback(
    (params: URLSearchParams, extras: string[]) => {
      const value = serializeExtras(extras);
      if (value) params.set(EXTRAS_PARAM, value);
      else params.delete(EXTRAS_PARAM);
    },
    []
  );

  const removeStat = useCallback(
    (key: string) => {
      if (!statKey) return;
      if (orderedStats.length <= 1) return; // never drop the last
      if (!orderedStats.includes(key)) return;

      if (key === statKey) {
        // Re-anchor to the next stat in the list.
        const next = orderedStats[1];
        if (!next) return;
        const newExtras = orderedStats.slice(2);
        const nextParams = new URLSearchParams(searchParams);
        setExtrasInParams(nextParams, newExtras);
        navigate(`/stats/${encodeURIComponent(next)}${buildSearchString(nextParams)}`);
        return;
      }

      const newExtras = orderedStats.slice(1).filter((k) => k !== key);
      setSearchParams((prev) => {
        const nextParams = new URLSearchParams(prev);
        setExtrasInParams(nextParams, newExtras);
        return nextParams;
      });
    },
    [statKey, orderedStats, navigate, searchParams, setSearchParams, setExtrasInParams]
  );

  const toggleStat = useCallback(
    (key: string) => {
      if (!statKey) return;
      if (orderedStats.includes(key)) {
        removeStat(key);
        return;
      }
      if (isAtCap) return;
      const newExtras = [...orderedStats.slice(1), key];
      setSearchParams((prev) => {
        const nextParams = new URLSearchParams(prev);
        setExtrasInParams(nextParams, newExtras);
        return nextParams;
      });
    },
    [statKey, orderedStats, isAtCap, removeStat, setSearchParams, setExtrasInParams]
  );

  return {
    orderedStats,
    toggleStat,
    removeStat,
    isAtCap,
    cap: STAT_SELECTION_CAP,
    count,
  };
}
