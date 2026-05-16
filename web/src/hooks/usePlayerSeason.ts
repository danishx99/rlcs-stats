import { useMemo } from "react";
import { api } from "../api";
import type { SeasonRow } from "../types/api";
import { useAsyncResource } from "./useAsyncResource";

type SeasonGameMode = "1s" | "2s" | "3s";
type SeasonStatMode = "avg" | "total";

export function usePlayerSeason(
  uniqueId: string | undefined,
  seasonGameMode: SeasonGameMode,
  seasonStatMode: SeasonStatMode,
  seasonIncludeLans: boolean
) {
  const { data, loading, error, reload } = useAsyncResource(
    async () => {
      if (!uniqueId) return [] as SeasonRow[];
      const response = await api.playerSeason(uniqueId, {
        mode: seasonStatMode,
        gameMode: seasonGameMode,
        scope: seasonGameMode === "3s" && !seasonIncludeLans ? "regional" : undefined,
        tier: seasonGameMode === "3s" && !seasonIncludeLans ? "none" : undefined
      });
      return response.rows ?? [];
    },
    [uniqueId, seasonGameMode, seasonStatMode, seasonIncludeLans]
  );

  return useMemo(() => ({
    seasonRows: data ?? [],
    seasonLoading: loading,
    seasonError: error ? "Failed to load seasonal performance." : null,
    retrySeason: reload
  }), [data, error, loading, reload]);
}
