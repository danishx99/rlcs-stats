export type SeriesFilters = {
  mode: string;
  includeLans: boolean;
  season: string;
  split: string;
  event: string;
  stage: string;
  team: string;
  team2: string;
};

export const DEFAULT_SERIES_FILTERS: SeriesFilters = {
  mode: "3s",
  includeLans: false,
  season: "",
  split: "",
  event: "",
  stage: "",
  team: "",
  team2: ""
};

export function seriesScopeParams(filters: SeriesFilters) {
  if (filters.mode === "3s" && filters.includeLans) {
    return {
      includeLans: "1" as const,
      scope: undefined,
      tier: undefined
    };
  }

  if (filters.mode === "3s") {
    return {
      includeLans: undefined,
      scope: "regional" as const,
      tier: "none" as const
    };
  }

  return {
    includeLans: undefined,
    scope: "regional" as const,
    tier: "none" as const
  };
}

export function buildSeriesMetaParams(filters: SeriesFilters) {
  const scope = seriesScopeParams(filters);
  return {
    gameMode: filters.mode,
    includeLans: scope.includeLans,
    scope: scope.scope,
    tier: scope.tier,
    season: filters.season || undefined,
    split: filters.split || undefined,
    event: filters.event || undefined,
    stage: filters.stage || undefined
  };
}

export function buildSeriesListParams(filters: SeriesFilters) {
  return {
    ...buildSeriesMetaParams(filters),
    team: filters.team || undefined,
    team2: filters.team2 || undefined
  };
}
