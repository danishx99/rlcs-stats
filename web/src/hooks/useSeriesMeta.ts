import { useMemo } from "react";
import { api } from "../api";
import type { SeriesMetaResponse } from "../types/api";
import { buildSeriesMetaParams, type SeriesFilters } from "../utils/series-filters";
import { useAsyncResource } from "./useAsyncResource";

export function useSeriesMeta(filters: SeriesFilters) {
  const { data, loading, error } = useAsyncResource(
    async () => api.seriesMeta({ ...buildSeriesMetaParams(filters) }),
    [filters.event, filters.includeLans, filters.mode, filters.season, filters.split, filters.stage]
  );

  return useMemo(() => ({
    meta: (data as SeriesMetaResponse | null) ?? null,
    metaLoading: loading,
    metaError: error ? "Failed to load series filters" : null
  }), [data, error, loading]);
}
