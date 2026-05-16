import { buildFilterClauses, normalizeFilter, normalizeMode } from "./filters";
import { normalizeDay, normalizePhase } from "./phases";
import { columnRef } from "./sql";

export type StatsTopIntent = {
  metricKey: string;
  mode: "avg" | "total";
  type: "player" | "team";
  sortDir: "ASC" | "DESC";
  limit: number;
  phase: string;
  day: string;
  ssaOnly: boolean;
  arena: string | null;
  minSeries: number;
  minGames: number;
  clauses: string[];
  values: Array<string | number>;
};

export function parseStatsTopIntent(url: URL): StatsTopIntent {
  const metricKey = url.searchParams.get("metric") ?? "score";
  const mode = normalizeMode(url.searchParams.get("mode"));
  const type = url.searchParams.get("type") === "team" ? "team" : "player";
  const sortDir = url.searchParams.get("sort") === "asc" ? "ASC" : "DESC";
  const limit = Math.min(Number.parseInt(url.searchParams.get("limit") ?? "10", 10), 50);

  const base = buildFilterClauses(url.searchParams, "s");
  const values: Array<string | number> = [...base.values];
  const clauses = [...base.clauses];

  const phase = normalizePhase(url.searchParams.get("phase"));
  if (phase !== "all") {
    values.push(phase);
    clauses.push(`LOWER(TRIM(COALESCE(s."Stage", ''))) = LOWER($${values.length})`);
  }

  const day = normalizeDay(url.searchParams.get("day"));
  if (day !== "all") {
    values.push(day);
    clauses.push(`LOWER(TRIM(COALESCE(s."Day"::text, ''))) = LOWER($${values.length})`);
  }

  const ssaOnly = url.searchParams.get("ssaOnly") === "1";
  const arena = url.searchParams.get("arena")?.trim() || null;
  if (arena) {
    values.push(arena);
    clauses.push(`s."Arena" = $${values.length}`);
  }

  const minSeries = Number.parseInt(url.searchParams.get("minSeries") ?? "0", 10);
  const minGames = Number.parseInt(url.searchParams.get("minGames") ?? "0", 10);

  return {
    metricKey,
    mode,
    type,
    sortDir,
    limit,
    phase,
    day,
    ssaOnly,
    arena,
    minSeries,
    minGames,
    clauses,
    values
  };
}

export type EventQueryIntent = {
  teamsLimit: number;
  leaderboardMode: "avg" | "total";
  selectedPhase: string;
  selectedDay: string;
  arena: string | null;
};

export function parseEventQueryIntent(url: URL, defaults: { teamsLimit: number; maxTeamsLimit: number }): EventQueryIntent {
  const teamsLimitRaw = Number.parseInt(url.searchParams.get("teamsLimit") ?? "", 10);
  const teamsLimit = Number.isFinite(teamsLimitRaw) && teamsLimitRaw > 0
    ? Math.min(teamsLimitRaw, defaults.maxTeamsLimit)
    : defaults.teamsLimit;

  return {
    teamsLimit,
    leaderboardMode: normalizeMode(url.searchParams.get("mode")),
    selectedPhase: normalizePhase(url.searchParams.get("phase")),
    selectedDay: normalizeDay(url.searchParams.get("day")),
    arena: url.searchParams.get("arena")?.trim() || null
  };
}

export type SeriesFilters = {
  mode: string | null;
  scope: string | null;
  tier: string | null;
  season: string | null;
  split: string | null;
  event: string | null;
  stage: string | null;
  team: string | null;
  team2: string | null;
};

export type SeriesFilterFlags = {
  mode?: boolean;
  scope?: boolean;
  tier?: boolean;
  season?: boolean;
  split?: boolean;
  event?: boolean;
  stage?: boolean;
};

export function parseSeriesFilters(url: URL): { filters: SeriesFilters | null; error: string | null } {
  const mode = normalizeFilter(url.searchParams.get("gameMode"))
    ?? normalizeFilter(url.searchParams.get("mode"));
  const includeLans = url.searchParams.get("includeLans") === "1";
  if (!mode) {
    return { filters: null, error: "mode is required" };
  }

  let scope = normalizeFilter(url.searchParams.get("scope"));
  let tier = normalizeFilter(url.searchParams.get("tier"));
  if (mode !== "3s") {
    scope = "regional";
    tier = "none";
  } else if (!includeLans) {
    scope = scope ?? "regional";
    tier = tier ?? "none";
  } else {
    scope = null;
    tier = null;
  }

  return {
    filters: {
      mode,
      scope,
      tier,
      season: normalizeFilter(url.searchParams.get("season")),
      split: normalizeFilter(url.searchParams.get("split")),
      event: normalizeFilter(url.searchParams.get("event")),
      stage: normalizeFilter(url.searchParams.get("stage")),
      team: normalizeFilter(url.searchParams.get("team")),
      team2: normalizeFilter(url.searchParams.get("team2"))
    },
    error: null
  };
}

export function buildSeriesFilterClauses(filters: SeriesFilters, alias: string, flags: SeriesFilterFlags = {}) {
  const clauses: string[] = [];
  const values: Array<string | number> = [];

  if (flags.mode && filters.mode) {
    clauses.push(`LOWER(TRIM(${columnRef(alias, "mode")})) = LOWER($${values.length + 1})`);
    values.push(filters.mode);
  }
  if (flags.scope && filters.scope) {
    clauses.push(`LOWER(TRIM(${columnRef(alias, "scope")})) = LOWER($${values.length + 1})`);
    values.push(filters.scope);
  }
  if (flags.tier && filters.tier) {
    clauses.push(`LOWER(TRIM(${columnRef(alias, "tier")})) = LOWER($${values.length + 1})`);
    values.push(filters.tier);
  }
  if (flags.season && filters.season) {
    clauses.push(`LOWER(TRIM(${columnRef(alias, "Season")})) = LOWER($${values.length + 1})`);
    values.push(filters.season);
  }
  if (flags.split && filters.split) {
    clauses.push(`LOWER(TRIM(${columnRef(alias, "Split")})) = LOWER($${values.length + 1})`);
    values.push(filters.split);
  }
  if (flags.event && filters.event) {
    clauses.push(`LOWER(TRIM(${columnRef(alias, "Event")})) = LOWER($${values.length + 1})`);
    values.push(filters.event);
  }
  if (flags.stage && filters.stage) {
    clauses.push(`LOWER(TRIM(${columnRef(alias, "Stage")})) = LOWER($${values.length + 1})`);
    values.push(filters.stage);
  }

  return { clauses, values };
}

export function buildSeriesTeamClause(filters: SeriesFilters, startIndex: number, alias = "st") {
  const teamValues = Array.from(
    new Set(
      [filters.team, filters.team2]
        .map((entry) => (entry ? entry.toUpperCase() : null))
        .filter((entry): entry is string => Boolean(entry))
    )
  );

  if (!teamValues.length) {
    return { clause: "", values: [] as string[] };
  }

  if (teamValues.length === 1) {
    return {
      clause: `(${alias}.team_a = $${startIndex} OR ${alias}.team_b = $${startIndex})`,
      values: [teamValues[0]]
    };
  }

  return {
    clause: `(${alias}.team_a IN ($${startIndex}, $${startIndex + 1}) AND ${alias}.team_b IN ($${startIndex}, $${startIndex + 1}))`,
    values: [teamValues[0], teamValues[1]]
  };
}
