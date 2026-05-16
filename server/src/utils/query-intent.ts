import { buildFilterClauses, normalizeMode } from "./filters";
import { normalizeDay, normalizePhase } from "./phases";

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
