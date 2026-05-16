import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import type { LeaderboardResponse } from "../types/api";

export type StatLeaderboardQuery = {
  type: "player" | "team";
  mode: "avg" | "total";
  sort: "asc" | "desc";
  limit: number;
  gameMode?: string;
  scope?: string;
  tier?: string;
  season?: string;
  split?: string;
  event?: string;
  arena?: string;
  minGames?: number;
  phase?: string;
  day?: string;
  ssaOnly?: boolean;
};

type UseStatLeaderboardsResult = {
  dataByKey: Map<string, LeaderboardResponse>;
  loadingByKey: Set<string>;
  errorByKey: Map<string, string>;
};

function serializeQuery(q: StatLeaderboardQuery): string {
  return [
    q.type,
    q.mode,
    q.sort,
    q.limit,
    q.gameMode ?? "",
    q.scope ?? "",
    q.tier ?? "",
    q.season ?? "",
    q.split ?? "",
    q.event ?? "",
    q.arena ?? "",
    q.minGames ?? 0,
    q.phase ?? "",
    q.day ?? "",
    q.ssaOnly ? "1" : "0",
  ].join("|");
}

export function useStatLeaderboards(
  orderedStats: string[],
  query: StatLeaderboardQuery
): UseStatLeaderboardsResult {
  const [dataByKey, setDataByKey] = useState<Map<string, LeaderboardResponse>>(new Map());
  const [loadingByKey, setLoadingByKey] = useState<Set<string>>(new Set());
  const [errorByKey, setErrorByKey] = useState<Map<string, string>>(new Map());

  const querySig = serializeQuery(query);
  const lastQuerySigRef = useRef<string>(querySig);

  // Drop cached data for keys no longer selected.
  useEffect(() => {
    const selected = new Set(orderedStats);
    setDataByKey((prev) => {
      let changed = false;
      const next = new Map(prev);
      for (const key of prev.keys()) {
        if (!selected.has(key)) {
          next.delete(key);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
    setErrorByKey((prev) => {
      let changed = false;
      const next = new Map(prev);
      for (const key of prev.keys()) {
        if (!selected.has(key)) {
          next.delete(key);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [orderedStats]);

  useEffect(() => {
    if (orderedStats.length === 0) return;
    const queryChanged = lastQuerySigRef.current !== querySig;
    lastQuerySigRef.current = querySig;

    // Decide which keys to fetch: all on query change, otherwise just new keys.
    let toFetch: string[];
    if (queryChanged) {
      toFetch = [...orderedStats];
    } else {
      toFetch = orderedStats.filter((key) => !dataByKey.has(key) && !errorByKey.has(key));
    }
    if (toFetch.length === 0) return;

    let cancelled = false;
    setLoadingByKey((prev) => {
      const next = new Set(prev);
      toFetch.forEach((k) => next.add(k));
      return next;
    });

    Promise.allSettled(
      toFetch.map((metric) =>
        api
          .statsTop({
            metric,
            mode: query.mode,
            type: query.type,
            sort: query.sort === "asc" ? "asc" : undefined,
            ssaOnly: (query.ssaOnly ?? query.type === "player") ? "1" : undefined,
            gameMode: query.gameMode || undefined,
            scope: query.scope || undefined,
            tier: query.tier || undefined,
            season: query.season || undefined,
            split: query.split || undefined,
            event: query.event || undefined,
            arena: query.arena || undefined,
            minGames: query.minGames && query.minGames > 0 ? query.minGames : undefined,
            phase: query.phase && query.phase !== "all" ? query.phase : undefined,
            day: query.day && query.day !== "all" ? query.day : undefined,
            limit: query.limit,
          })
          .then((result) => ({ metric, result }))
      )
    ).then((outcomes) => {
      if (cancelled) return;
      setDataByKey((prev) => {
        const next = new Map(prev);
        outcomes.forEach((outcome, index) => {
          const metric = toFetch[index];
          if (!metric) return;
          if (outcome.status === "fulfilled") {
            next.set(metric, outcome.value.result);
          }
        });
        return next;
      });
      setErrorByKey((prev) => {
        const next = new Map(prev);
        outcomes.forEach((outcome, index) => {
          const metric = toFetch[index];
          if (!metric) return;
          if (outcome.status === "fulfilled") {
            next.delete(metric);
          } else {
            const reason =
              outcome.reason instanceof Error ? outcome.reason.message : "Request failed";
            next.set(metric, reason);
          }
        });
        return next;
      });
      setLoadingByKey((prev) => {
        const next = new Set(prev);
        toFetch.forEach((k) => next.delete(k));
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
    // Intentionally narrow deps: re-fetch ALL stats when the query changes,
    // otherwise fetch ONLY newly-selected stats. Including dataByKey/errorByKey
    // would re-trigger the effect after every successful/failed fetch and loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderedStats, querySig]);

  return { dataByKey, loadingByKey, errorByKey };
}
