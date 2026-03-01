import { useEffect, useState } from "react";
import { api } from "../api";
import type { MetaResponse } from "../types/api";
import type { Filters } from "../types/ui";

export function useMeta(filters: Filters) {
  const [meta, setMeta] = useState<MetaResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadMeta() {
      try {
        const response = await api.meta({
          gameMode: filters.mode || undefined,
          scope: filters.scope || undefined,
          tier: filters.tier || undefined,
          season: filters.season || undefined,
          split: filters.split || undefined
        });
        if (!cancelled) {
          setMeta(response);
        }
      } catch (error) {
        console.error(error);
      }
    }

    loadMeta();

    return () => {
      cancelled = true;
    };
  }, [filters.mode, filters.scope, filters.tier, filters.season, filters.split]);

  return { meta };
}
