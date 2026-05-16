import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";
import type { PlayerResultEvent } from "../types/api";
import { useAsyncResource } from "./useAsyncResource";

type ResultsViewMode = "season" | "all";

type CachedAllTime = {
  playerId: string;
  events: PlayerResultEvent[];
  seasons: string[];
};

type PlayerResultsData = {
  events: PlayerResultEvent[];
  seasons: string[];
};

export function usePlayerResults(
  uniqueId: string | undefined,
  resultsViewMode: ResultsViewMode,
  resultSeason: string,
  setResultSeason: (value: string | ((current: string) => string)) => void
) {
  const allTimeCacheRef = useRef<CachedAllTime | null>(null);
  const allTimePrefetchedRef = useRef<string | null>(null);
  const [hasLanEvents, setHasLanEvents] = useState(false);

  useEffect(() => {
    allTimeCacheRef.current = null;
    allTimePrefetchedRef.current = null;
    setHasLanEvents(false);
  }, [uniqueId]);

  const { data, loading, error, reload } = useAsyncResource(
    async () => {
      if (!uniqueId) {
        return { events: [], seasons: [] } as PlayerResultsData;
      }
      if (resultsViewMode === "all" && allTimeCacheRef.current?.playerId === uniqueId) {
        return {
          events: allTimeCacheRef.current.events,
          seasons: allTimeCacheRef.current.seasons
        };
      }

      const params: Record<string, string> = {};
      if (resultsViewMode === "season" && resultSeason) params.season = resultSeason;
      const response = await api.playerResults(uniqueId, params);
      const seasons = (response.seasons ?? []).filter(Boolean).reverse();

      if (resultsViewMode === "all") {
        allTimeCacheRef.current = { playerId: uniqueId, events: response.events, seasons };
      }
      if (response.events.some((event) => event.scope === "international")) {
        setHasLanEvents(true);
      }

      return { events: response.events, seasons };
    },
    [uniqueId, resultsViewMode, resultSeason]
  );

  useEffect(() => {
    const seasons = data?.seasons ?? [];
    if (!seasons.length) return;
    setResultSeason((current) => {
      if (current && seasons.includes(current)) return current;
      return seasons[0] ?? "";
    });
  }, [data?.seasons, setResultSeason]);

  useEffect(() => {
    if (!uniqueId || allTimePrefetchedRef.current === uniqueId || !resultSeason) return;
    allTimePrefetchedRef.current = uniqueId;

    api.playerResults(uniqueId)
      .then((response) => {
        if (allTimePrefetchedRef.current !== uniqueId) return;
        const seasons = (response.seasons ?? []).filter(Boolean).reverse();
        allTimeCacheRef.current = { playerId: uniqueId, events: response.events, seasons };
        if (response.events.some((event) => event.scope === "international")) {
          setHasLanEvents(true);
        }
      })
      .catch(() => {
        allTimePrefetchedRef.current = null;
      });
  }, [uniqueId, resultSeason]);

  return useMemo(() => ({
    results: data?.events ?? [],
    resultSeasons: data?.seasons ?? [],
    resultsLoading: loading,
    resultsError: error ? "Failed to load event results." : null,
    retryResults: reload,
    playerHasLanEvents: hasLanEvents,
    getAllEventsForTeamRouting: () => {
      const cache = allTimeCacheRef.current;
      if (cache && cache.playerId === uniqueId) return cache.events;
      return data?.events ?? [];
    }
  }), [data?.events, data?.seasons, error, hasLanEvents, loading, reload, uniqueId]);
}
