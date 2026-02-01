import { useEffect, useState } from "react";
import { api } from "../api";
import type { MetaResponse } from "../types/api";
import type { Filters } from "../types/ui";

export function useMeta(filters: Filters) {
  const [meta, setMeta] = useState<MetaResponse | null>(null);
  const [metaError, setMetaError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadMeta() {
      try {
        const response = await api.meta({
          season: filters.season || undefined,
          split: filters.split || undefined
        });
        if (!cancelled) {
          setMeta(response);
          setMetaError(null);
        }
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setMetaError("Failed to load metadata");
        }
      }
    }

    loadMeta();

    return () => {
      cancelled = true;
    };
  }, [filters.season, filters.split]);

  return { meta, metaError };
}
