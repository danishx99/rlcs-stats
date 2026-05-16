import { useMemo } from "react";
import { api } from "../api";
import type { RosterEventResultRow } from "../types/api";
import { useAsyncResource } from "./useAsyncResource";

const ROSTER_MODE = "3s" as const;

export function useRosterResults(rosterId: string | undefined, season: string) {
  const { data, loading, error, reload } = useAsyncResource(
    async () => {
      if (!rosterId || !season) return [] as RosterEventResultRow[];
      const response = await api.rosterResults(rosterId, {
        season,
        gameMode: ROSTER_MODE
      });
      return response.rows ?? [];
    },
    [rosterId, season]
  );

  return useMemo(() => ({
    resultRows: data ?? [],
    resultsLoading: loading,
    resultsError: error ? "Failed to load team results." : null,
    retryResults: reload
  }), [data, error, loading, reload]);
}
