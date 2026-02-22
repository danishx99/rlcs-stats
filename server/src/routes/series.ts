import { type IncomingMessage, type ServerResponse } from "node:http";
import { pool } from "../db";
import { json } from "../utils/http";
import { normalizeFilter } from "../utils/filters";
import { formatSql, loadSql } from "../utils/sql";

const seriesMetaSeasonsSql = loadSql("../../sql/series/meta_seasons.sql", import.meta.url);
const seriesMetaSplitsSql = loadSql("../../sql/series/meta_splits.sql", import.meta.url);
const seriesMetaEventsSql = loadSql("../../sql/series/meta_events.sql", import.meta.url);
const seriesMetaStagesSql = loadSql("../../sql/series/meta_stages.sql", import.meta.url);
const seriesMetaTeamsSql = loadSql("../../sql/series/meta_teams.sql", import.meta.url);
const seriesListSql = loadSql("../../sql/series/list.sql", import.meta.url);
const seriesDetailSql = loadSql("../../sql/series/detail.sql", import.meta.url);

type SeriesFilters = {
  season: string | null;
  split: string | null;
  event: string | null;
  stage: string | null;
  team: string | null;
  team2: string | null;
};

type SeriesFilterFlags = {
  season?: boolean;
  split?: boolean;
  event?: boolean;
  stage?: boolean;
};

function parseSeriesFilters(url: URL): { filters: SeriesFilters | null; error: string | null } {
  const season = normalizeFilter(url.searchParams.get("season"));
  const split = normalizeFilter(url.searchParams.get("split"));
  const event = normalizeFilter(url.searchParams.get("event"));
  const stage = normalizeFilter(url.searchParams.get("stage"));
  const team = normalizeFilter(url.searchParams.get("team"));
  const team2 = normalizeFilter(url.searchParams.get("team2"));

  return {
    filters: { season, split, event, stage, team, team2 },
    error: null
  };
}

function columnRef(alias: string, column: string) {
  return alias ? `${alias}."${column}"` : `"${column}"`;
}

function buildSeriesFilterClauses(filters: SeriesFilters, alias: string, flags: SeriesFilterFlags = {}) {
  const clauses: string[] = [];
  const values: Array<string | number> = [];

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

function buildSeriesTeamClause(filters: SeriesFilters, startIndex: number, alias = "st") {
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

function mapNullableString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function mapNullableNumber(value: unknown): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function mapNumber(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function mapDate(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }
  if (value instanceof Date && !Number.isNaN(value.valueOf())) {
    return value.toISOString().slice(0, 10);
  }
  return null;
}

function parseGames(value: unknown) {
  if (!Array.isArray(value)) return [] as Array<{
    gameNumber: number;
    matchId: string | null;
    teamAGoals: number | null;
    teamBGoals: number | null;
    winnerTeam: string | null;
  }>;

  return value
    .map((entry) => {
      const row = typeof entry === "object" && entry !== null ? (entry as Record<string, unknown>) : {};
      const gameNumber = mapNullableNumber(row.gameNumber);
      if (gameNumber === null) return null;

      return {
        gameNumber,
        matchId: mapNullableString(row.matchId),
        teamAGoals: mapNullableNumber(row.teamAGoals),
        teamBGoals: mapNullableNumber(row.teamBGoals),
        winnerTeam: mapNullableString(row.winnerTeam)
      };
    })
    .filter((row): row is {
      gameNumber: number;
      matchId: string | null;
      teamAGoals: number | null;
      teamBGoals: number | null;
      winnerTeam: string | null;
    } => row !== null);
}

export async function handleSeriesMeta(_req: IncomingMessage, res: ServerResponse, url: URL) {
  const { filters, error } = parseSeriesFilters(url);
  if (error || !filters) {
    json(res, 400, { error: error ?? "Invalid filters" });
    return;
  }

  const splitFilters = buildSeriesFilterClauses(filters, "", { season: true });
  const eventFilters = buildSeriesFilterClauses(filters, "", { season: true, split: true });
  const stageFilters = buildSeriesFilterClauses(filters, "", {
    season: true,
    split: true,
    event: true
  });
  const teamFilters = buildSeriesFilterClauses(filters, "", {
    season: true,
    split: true,
    event: true,
    stage: true
  });

  const splitWhere = splitFilters.clauses.length ? `AND ${splitFilters.clauses.join(" AND ")}` : "";
  const eventWhere = eventFilters.clauses.length ? `AND ${eventFilters.clauses.join(" AND ")}` : "";
  const stageWhere = stageFilters.clauses.length ? `AND ${stageFilters.clauses.join(" AND ")}` : "";
  const teamWhere = teamFilters.clauses.length ? `AND ${teamFilters.clauses.join(" AND ")}` : "";

  try {
    const [seasons, splits, events, stages, teams] = await Promise.all([
      pool.query(seriesMetaSeasonsSql),
      pool.query(formatSql(seriesMetaSplitsSql, { where: splitWhere }), splitFilters.values),
      pool.query(formatSql(seriesMetaEventsSql, { where: eventWhere }), eventFilters.values),
      pool.query(formatSql(seriesMetaStagesSql, { where: stageWhere }), stageFilters.values),
      pool.query(formatSql(seriesMetaTeamsSql, { where: teamWhere }), teamFilters.values)
    ]);

    json(res, 200, {
      generatedAt: new Date().toISOString(),
      seasons: seasons.rows.map((row) => mapNullableString(row.value)).filter(Boolean),
      splits: splits.rows.map((row) => mapNullableString(row.value)).filter(Boolean),
      events: events.rows.map((row) => mapNullableString(row.value)).filter(Boolean),
      stages: stages.rows.map((row) => mapNullableString(row.value)).filter(Boolean),
      teams: teams.rows.map((row) => mapNullableString(row.value)).filter(Boolean)
    });
  } catch (routeError) {
    console.error(routeError);
    json(res, 500, { error: "Failed to load series metadata" });
  }
}

export async function handleSeriesList(_req: IncomingMessage, res: ServerResponse, url: URL) {
  const { filters, error } = parseSeriesFilters(url);
  if (error || !filters) {
    json(res, 400, { error: error ?? "Invalid filters" });
    return;
  }

  const { clauses, values } = buildSeriesFilterClauses(filters, "s", {
    season: true,
    split: true,
    event: true,
    stage: true
  });
  const teamFilter = buildSeriesTeamClause(filters, values.length + 1, "st");
  const where = clauses.length ? `AND ${clauses.join(" AND ")}` : "";
  const seriesWhere = teamFilter.clause ? `WHERE ${teamFilter.clause}` : "";

  try {
    const result = await pool.query(
      formatSql(seriesListSql, { where, seriesWhere }),
      [...values, ...teamFilter.values]
    );

    const rows = result.rows
      .map((row) => {
        const seriesId = mapNullableString(row.series_id);
        if (!seriesId) return null;

        return {
          seriesId,
          date: mapDate(row.date),
          season: mapNullableString(row.season),
          split: mapNullableString(row.split),
          event: mapNullableString(row.event),
          stage: mapNullableString(row.stage),
          round: mapNullableString(row.round),
          day: mapNullableNumber(row.day),
          bestOf: mapNullableNumber(row.best_of),
          teamA: mapNullableString(row.team_a),
          teamB: mapNullableString(row.team_b),
          teamAWins: mapNumber(row.team_a_wins),
          teamBWins: mapNumber(row.team_b_wins),
          gamesRecorded: mapNumber(row.games_recorded)
        };
      })
      .filter((row): row is {
        seriesId: string;
        date: string | null;
        season: string | null;
        split: string | null;
        event: string | null;
        stage: string | null;
        round: string | null;
        day: number | null;
        bestOf: number | null;
        teamA: string | null;
        teamB: string | null;
        teamAWins: number;
        teamBWins: number;
        gamesRecorded: number;
      } => row !== null);

    json(res, 200, { rows });
  } catch (routeError) {
    console.error(routeError);
    json(res, 500, { error: "Failed to load series list" });
  }
}

export async function handleSeriesDetail(
  _req: IncomingMessage,
  res: ServerResponse,
  seriesId: string
) {
  const normalizedSeriesId = decodeURIComponent(seriesId).trim();
  if (!normalizedSeriesId) {
    json(res, 400, { error: "series id is required" });
    return;
  }

  try {
    const result = await pool.query(
      formatSql(seriesDetailSql, {
        seriesIdParam: "$1"
      }),
      [normalizedSeriesId]
    );

    if (!result.rows.length) {
      json(res, 404, { error: "Series not found" });
      return;
    }

    const row = result.rows[0];
    const foundSeriesId = mapNullableString(row.series_id);
    if (!foundSeriesId) {
      json(res, 404, { error: "Series not found" });
      return;
    }

    json(res, 200, {
      series: {
        seriesId: foundSeriesId,
        date: mapDate(row.date),
        season: mapNullableString(row.season),
        split: mapNullableString(row.split),
        event: mapNullableString(row.event),
        stage: mapNullableString(row.stage),
        round: mapNullableString(row.round),
        day: mapNullableNumber(row.day),
        bestOf: mapNullableNumber(row.best_of),
        teamA: mapNullableString(row.team_a),
        teamB: mapNullableString(row.team_b),
        teamAWins: mapNumber(row.team_a_wins),
        teamBWins: mapNumber(row.team_b_wins),
        gamesRecorded: mapNumber(row.games_recorded),
        games: parseGames(row.games)
      }
    });
  } catch (routeError) {
    console.error(routeError);
    json(res, 500, { error: "Failed to load series details" });
  }
}
