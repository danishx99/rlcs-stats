import { useMemo } from "react";
import { api } from "../api";
import type { SeriesDetail } from "../types/api";
import { useAsyncResource } from "./useAsyncResource";

export function useSeriesDetail(selectedSeriesId: string | null) {
  const { data, loading, error } = useAsyncResource(
    async () => {
      if (!selectedSeriesId) return null;
      const response = await api.seriesDetail(selectedSeriesId);
      return response.series;
    },
    [selectedSeriesId]
  );

  return useMemo(() => ({
    selectedSeriesDetail: (data as SeriesDetail | null) ?? null,
    detailLoading: loading,
    detailError: error ? "Failed to load series details" : null
  }), [data, error, loading]);
}
