import { useMemo } from "react";
import { api } from "../api";
import type { SeriesListRow } from "../types/api";
import { buildSeriesListParams, type SeriesFilters } from "../utils/series-filters";
import { useAsyncResource } from "./useAsyncResource";

export function useSeriesList(filters: SeriesFilters) {
  const { data, loading, error } = useAsyncResource(
    async () => {
      const response = await api.seriesList({ ...buildSeriesListParams(filters) });
      return response.rows ?? [];
    },
    [filters.event, filters.includeLans, filters.mode, filters.season, filters.split, filters.stage, filters.team, filters.team2]
  );

  return useMemo(() => ({
    seriesRows: (data as SeriesListRow[] | null) ?? [],
    seriesLoading: loading,
    seriesError: error ? "Failed to load series" : null
  }), [data, error, loading]);
}
