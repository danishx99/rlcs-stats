import type { Context } from "hono";
import { pool } from "../db";
import { errorJson, jsonCached } from "../utils/responses";
import { formatSql, loadSql } from "../utils/sql";
import { buildSeriesFilterClauses, buildSeriesTeamClause, parseSeriesFilters } from "../utils/query-intent";
import { toDateString, toNullableNumber, toNullableString, toNumber } from "../utils/response-mappers";

const seriesMetaSeasonsSql = loadSql("../../sql/series/meta_seasons.sql", import.meta.url);
const seriesMetaSplitsSql = loadSql("../../sql/series/meta_splits.sql", import.meta.url);
const seriesMetaEventsSql = loadSql("../../sql/series/meta_events.sql", import.meta.url);
const seriesMetaStagesSql = loadSql("../../sql/series/meta_stages.sql", import.meta.url);
const seriesMetaTeamsSql = loadSql("../../sql/series/meta_teams.sql", import.meta.url);
const seriesListSql = loadSql("../../sql/series/list.sql", import.meta.url);
const seriesDetailSql = loadSql("../../sql/series/detail.sql", import.meta.url);

type SeriesGame = {
  gameNumber: number;
  matchId: string | null;
  teamAGoals: number | null;
  teamBGoals: number | null;
  winnerTeam: string | null;
};

type SeriesListRow = {
  seriesId: string;
  eventId: string | null;
  date: string | null;
  season: string | null;
  mode: string | null;
  scope: string | null;
  tier: string | null;
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
};

function parseGames(value: unknown): SeriesGame[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry): SeriesGame | null => {
      const row = typeof entry === "object" && entry !== null ? (entry as Record<string, unknown>) : {};
      const gameNumber = toNullableNumber(row.gameNumber);
      if (gameNumber === null) return null;

      return {
        gameNumber,
        matchId: toNullableString(row.matchId),
        teamAGoals: toNullableNumber(row.teamAGoals),
        teamBGoals: toNullableNumber(row.teamBGoals),
        winnerTeam: toNullableString(row.winnerTeam)
      };
    })
    .filter((row): row is SeriesGame => row !== null);
}

export async function handleSeriesMeta(c: Context) {
  const { filters, error } = parseSeriesFilters(new URLSearchParams(c.req.query()));
  if (error || !filters) {
    return errorJson(c, 400, error ?? "Invalid filters");
  }

  const seasonFilters = buildSeriesFilterClauses(filters, "", {
    mode: true,
    scope: true,
    tier: true
  });
  const splitFilters = buildSeriesFilterClauses(filters, "", {
    mode: true,
    scope: true,
    tier: true,
    season: true
  });
  const eventFilters = buildSeriesFilterClauses(filters, "", {
    mode: true,
    scope: true,
    tier: true,
    season: true,
    split: true
  });
  const stageFilters = buildSeriesFilterClauses(filters, "", {
    mode: true,
    scope: true,
    tier: true,
    season: true,
    split: true,
    event: true
  });
  const teamFilters = buildSeriesFilterClauses(filters, "", {
    mode: true,
    scope: true,
    tier: true,
    season: true,
    split: true,
    event: true,
    stage: true
  });

  const seasonWhere = seasonFilters.clauses.length ? `AND ${seasonFilters.clauses.join(" AND ")}` : "";
  const splitWhere = splitFilters.clauses.length ? `AND ${splitFilters.clauses.join(" AND ")}` : "";
  const eventWhere = eventFilters.clauses.length ? `AND ${eventFilters.clauses.join(" AND ")}` : "";
  const stageWhere = stageFilters.clauses.length ? `AND ${stageFilters.clauses.join(" AND ")}` : "";
  const teamWhere = teamFilters.clauses.length ? `AND ${teamFilters.clauses.join(" AND ")}` : "";

  try {
    const [seasons, splits, events, stages, teams] = await Promise.all([
      pool.query(formatSql(seriesMetaSeasonsSql, { where: seasonWhere }), seasonFilters.values),
      pool.query(formatSql(seriesMetaSplitsSql, { where: splitWhere }), splitFilters.values),
      pool.query(formatSql(seriesMetaEventsSql, { where: eventWhere }), eventFilters.values),
      pool.query(formatSql(seriesMetaStagesSql, { where: stageWhere }), stageFilters.values),
      pool.query(formatSql(seriesMetaTeamsSql, { where: teamWhere }), teamFilters.values)
    ]);

    return jsonCached(c, {
      generatedAt: new Date().toISOString(),
      mode: filters.mode,
      scope: filters.scope,
      tier: filters.tier,
      seasons: seasons.rows.map((row) => toNullableString(row.value)).filter(Boolean),
      splits: splits.rows.map((row) => toNullableString(row.value)).filter(Boolean),
      events: events.rows.map((row) => toNullableString(row.value)).filter(Boolean),
      stages: stages.rows.map((row) => toNullableString(row.value)).filter(Boolean),
      teams: teams.rows.map((row) => toNullableString(row.value)).filter(Boolean)
    });
  } catch (routeError) {
    console.error(routeError);
    return errorJson(c, 500, "Failed to load series metadata");
  }
}

export async function handleSeriesList(c: Context) {
  const { filters, error } = parseSeriesFilters(new URLSearchParams(c.req.query()));
  if (error || !filters) {
    return errorJson(c, 400, error ?? "Invalid filters");
  }

  const { clauses, values } = buildSeriesFilterClauses(filters, "s", {
    mode: true,
    scope: true,
    tier: true,
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
      .map((row): SeriesListRow | null => {
        const seriesId = toNullableString(row.series_id);
        if (!seriesId) return null;

        return {
          seriesId,
          eventId: toNullableString(row.event_id),
          date: toDateString(row.date),
          season: toNullableString(row.season),
          mode: toNullableString(row.mode),
          scope: toNullableString(row.scope),
          tier: toNullableString(row.tier),
          split: toNullableString(row.split),
          event: toNullableString(row.event),
          stage: toNullableString(row.stage),
          round: toNullableString(row.round),
          day: toNullableNumber(row.day),
          bestOf: toNullableNumber(row.best_of),
          teamA: toNullableString(row.team_a),
          teamB: toNullableString(row.team_b),
          teamAWins: toNumber(row.team_a_wins),
          teamBWins: toNumber(row.team_b_wins),
          gamesRecorded: toNumber(row.games_recorded)
        };
      })
      .filter((row): row is SeriesListRow => row !== null);

    return jsonCached(c, { rows });
  } catch (routeError) {
    console.error(routeError);
    return errorJson(c, 500, "Failed to load series list");
  }
}

export async function handleSeriesDetail(c: Context, seriesId: string) {
  const normalizedSeriesId = decodeURIComponent(seriesId).trim();
  if (!normalizedSeriesId) {
    return errorJson(c, 400, "series id is required");
  }

  try {
    const result = await pool.query(
      formatSql(seriesDetailSql, {
        seriesIdParam: "$1"
      }),
      [normalizedSeriesId]
    );

    if (!result.rows.length) {
      return errorJson(c, 404, "Series not found");
    }

    const row = result.rows[0];
    const foundSeriesId = toNullableString(row.series_id);
    if (!foundSeriesId) {
      return errorJson(c, 404, "Series not found");
    }

    return jsonCached(c, {
      series: {
        seriesId: foundSeriesId,
        eventId: toNullableString(row.event_id),
        date: toDateString(row.date),
        mode: toNullableString(row.mode),
        scope: toNullableString(row.scope),
        tier: toNullableString(row.tier),
        season: toNullableString(row.season),
        split: toNullableString(row.split),
        event: toNullableString(row.event),
        stage: toNullableString(row.stage),
        round: toNullableString(row.round),
        day: toNullableNumber(row.day),
        bestOf: toNullableNumber(row.best_of),
        teamA: toNullableString(row.team_a),
        teamB: toNullableString(row.team_b),
        teamAWins: toNumber(row.team_a_wins),
        teamBWins: toNumber(row.team_b_wins),
        gamesRecorded: toNumber(row.games_recorded),
        games: parseGames(row.games)
      }
    });
  } catch (routeError) {
    console.error(routeError);
    return errorJson(c, 500, "Failed to load series details");
  }
}
