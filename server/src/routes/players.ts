import type { Context } from "hono";
import { pool } from "../db";
import { errorJson, jsonCached } from "../utils/responses";
import { buildFilterClauses, normalizeMode } from "../utils/filters";
import { metricExpression, resolveStatOption } from "../utils/stats";
import { formatSql, loadSql } from "../utils/sql";
import { playerKeyExpr } from "../utils/roster";
import { parseSpotlightParam, resolveSpotlightStats } from "../spotlight";
const playersListSql = loadSql("../../sql/players/list.sql", import.meta.url);
const playerSeasonSql = loadSql("../../sql/players/season.sql", import.meta.url);
const playerProfileSql = loadSql("../../sql/players/profile.sql", import.meta.url);
const playerResultsSql = loadSql("../../sql/players/results.sql", import.meta.url);

function normalizePlayerId(rawId: string) {
  let decoded = rawId;
  try {
    decoded = decodeURIComponent(rawId);
  } catch {
    decoded = rawId;
  }
  return decoded.trim().toUpperCase();
}

export async function handlePlayers(c: Context) {
  const params = new URLSearchParams(c.req.query());
  const { clauses, values } = buildFilterClauses(params, "s");
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const limit = Math.min(Number.parseInt(c.req.query("limit") ?? "20", 10), 100);
  const offset = Number.parseInt(c.req.query("offset") ?? "0", 10);
  const limitIndex = values.length + 1;
  const offsetIndex = values.length + 2;

  try {
    const result = await pool.query(
      formatSql(playersListSql, {
        playerKeyExpr: playerKeyExpr("s"),
        where,
        limitParam: `$${limitIndex}`,
        offsetParam: `$${offsetIndex}`
      }),
      [...values, limit, offset]
    );

    return jsonCached(c, {
      players: result.rows.map((row) => ({
        id: row.id,
        label: row.label,
        aliases: row.aliases,
        country: row.country,
        photoUrl: row.photo_url,
        teams: row.teams ?? [],
        games: Number(row.games ?? 0)
      }))
    });
  } catch (error) {
    console.error(error);
    return errorJson(c, 500, "Failed to load players");
  }
}

export async function handlePlayerProfile(c: Context, playerId: string) {
  const params = new URLSearchParams(c.req.query());
  const normalizedPlayerId = normalizePlayerId(playerId);
  const { clauses, values } = buildFilterClauses(params, "s");
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const playerIndex = values.length + 1;

  try {
    const queryParams = [...values, normalizedPlayerId];
    const [result, resultsForBest] = await Promise.all([
      pool.query(
        formatSql(playerProfileSql, {
          playerKeyExpr: playerKeyExpr("s"),
          where,
          playerIdParam: `$${playerIndex}`
        }),
        queryParams
      ),
      pool.query(
        formatSql(playerResultsSql, {
          where,
          playerIdParam: `$${playerIndex}`
        }),
        queryParams
      )
    ]);

    if (!result.rows.length || !result.rows[0].player_found) {
      return errorJson(c, 404, "Player not found");
    }

    const row = result.rows[0];
    const debutParts = [row.debut_season, row.debut_split, row.debut_event].filter(Boolean);
    const debut = debutParts.length ? debutParts.join(" / ") : null;

    const completedPlacementEnds = resultsForBest.rows
      .filter((eventRow) => (eventRow.status ?? "completed") === "completed")
      .map((eventRow) => Number(eventRow.placement_end))
      .filter((placementEnd) => Number.isFinite(placementEnd) && placementEnd > 0 && placementEnd < 999);

    const bestResult =
      completedPlacementEnds.length > 0
        ? `Top ${Math.min(...completedPlacementEnds)}`
        : row.best_result ?? null;

    const spotlightKeys = parseSpotlightParam(c.req.query("spotlight") ?? null);
    const customSpotlight = spotlightKeys.length
      ? await resolveSpotlightStats(normalizedPlayerId, spotlightKeys)
      : [];

    const totals: Record<string, number | null> = {
      goals: Number(row.goals_total ?? 0),
      assists: Number(row.assists_total ?? 0),
      saves: Number(row.saves_total ?? 0),
      demos: Number(row.demos_total ?? 0)
    };
    const averages: Record<string, number | null> = {
      goals: Number(row.goals_avg ?? 0),
      assists: Number(row.assists_avg ?? 0),
      saves: Number(row.saves_avg ?? 0),
      demos: Number(row.demos_avg ?? 0)
    };
    const ranksAvg: Record<string, number | null> = {
      goals: row.goals_rank_avg == null ? null : Number(row.goals_rank_avg),
      assists: row.assists_rank_avg == null ? null : Number(row.assists_rank_avg),
      saves: row.saves_rank_avg == null ? null : Number(row.saves_rank_avg),
      demos: row.demos_rank_avg == null ? null : Number(row.demos_rank_avg)
    };
    const ranksTotal: Record<string, number | null> = {
      goals: row.goals_rank_total == null ? null : Number(row.goals_rank_total),
      assists: row.assists_rank_total == null ? null : Number(row.assists_rank_total),
      saves: row.saves_rank_total == null ? null : Number(row.saves_rank_total),
      demos: row.demos_rank_total == null ? null : Number(row.demos_rank_total)
    };

    for (const stat of customSpotlight) {
      totals[stat.key] = stat.total;
      averages[stat.key] = stat.avg;
      ranksTotal[stat.key] = stat.rankTotal;
      ranksAvg[stat.key] = stat.rankAvg;
    }

    return jsonCached(c, {
      player: {
        id: row.player_id,
        handle: row.handle,
        playerName: row.player_name,
        aliases: row.aliases,
        realName: row.real_name,
        country: row.country,
        photoUrl: row.photo_url,
        dateOfBirth: row.date_of_birth,
        debut,
        bestResult,
        twitch: row.twitch,
        tiktok: row.tiktok,
        teams: row.teams ?? [],
        games: Number(row.games ?? 0),
        gamesWon: Number(row.games_won ?? 0),
        gamesLost: Number(row.games_lost ?? 0),
        seriesPlayed: Number(row.series_played ?? 0),
        totals,
        averages,
        ranks: {
          avg: ranksAvg,
          total: ranksTotal
        }
      }
    });
  } catch (error) {
    console.error(error);
    return errorJson(c, 500, "Failed to load player profile");
  }
}

export async function handlePlayerResults(c: Context, playerId: string) {
  const params = new URLSearchParams(c.req.query());
  const normalizedPlayerId = normalizePlayerId(playerId);
  const { clauses, values } = buildFilterClauses(params, "s");
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const playerIndex = values.length + 1;

  try {
    const result = await pool.query(
      formatSql(playerResultsSql, {
        where,
        playerIdParam: `$${playerIndex}`
      }),
      [...values, normalizedPlayerId]
    );

    const seasons: string[] = result.rows.length
      ? (result.rows[0].available_seasons ?? [])
      : [];

    const events = result.rows.map((row) => ({
      season: row.season,
      split: row.split,
      event: row.event,
      eventId: row.event_id ?? null,
      team: row.team ?? null,
      mode: row.mode ?? null,
      scope: row.scope ?? null,
      tier: row.tier ?? null,
      placementStart:
        row.placement_start === null || row.placement_start === undefined
          ? null
          : Number(row.placement_start),
      placementEnd:
        row.placement_end === null || row.placement_end === undefined
          ? null
          : Number(row.placement_end),
      placement: row.placement ?? null,
      status: row.status ?? "completed",
      series: (row.series ?? []).map((s: Record<string, unknown>) => ({
        seriesId: s.series_id ?? "",
        opponent: s.opponent ?? "",
        playerWins: Number(s.player_wins ?? 0),
        opponentWins: Number(s.opponent_wins ?? 0),
        bestOf: Number(s.best_of ?? 0),
        round: s.round ?? null,
        stage: s.stage ?? null,
        wonSeries: Boolean(s.won_series),
        date: s.date ?? null
      }))
    }));

    return jsonCached(c, { seasons, events });
  } catch (error) {
    console.error(error);
    return errorJson(c, 500, "Failed to load player results");
  }
}

export async function handlePlayerSeason(c: Context, playerId: string) {
  const params = new URLSearchParams(c.req.query());
  const normalizedPlayerId = normalizePlayerId(playerId);
  const { clauses, values } = buildFilterClauses(params, "s");
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const mode = normalizeMode(c.req.query("mode") ?? null);
  const playerIndex = values.length + 1;

  const goalsPrimaryExpr = metricExpression(resolveStatOption("goals"), mode, "player_scope");
  const assistsPrimaryExpr = metricExpression(resolveStatOption("assists"), mode, "player_scope");
  const savesPrimaryExpr = metricExpression(resolveStatOption("saves"), mode, "player_scope");
  const demosPrimaryExpr = metricExpression(resolveStatOption("demos"), mode, "player_scope");

  const goalsAvgExpr = metricExpression(resolveStatOption("goals"), "avg", "player_scope");
  const assistsAvgExpr = metricExpression(resolveStatOption("assists"), "avg", "player_scope");
  const savesAvgExpr = metricExpression(resolveStatOption("saves"), "avg", "player_scope");
  const demosAvgExpr = metricExpression(resolveStatOption("demos"), "avg", "player_scope");

  const goalsTotalExpr = metricExpression(resolveStatOption("goals"), "total", "player_scope");
  const assistsTotalExpr = metricExpression(resolveStatOption("assists"), "total", "player_scope");
  const savesTotalExpr = metricExpression(resolveStatOption("saves"), "total", "player_scope");
  const demosTotalExpr = metricExpression(resolveStatOption("demos"), "total", "player_scope");

  try {
    const result = await pool.query(
      formatSql(playerSeasonSql, {
        playerKeyExpr: playerKeyExpr("s"),
        where,
        playerIdParam: `$${playerIndex}`,
        goalsPrimaryExpr,
        goalsAvgExpr,
        goalsTotalExpr,
        assistsPrimaryExpr,
        assistsAvgExpr,
        assistsTotalExpr,
        savesPrimaryExpr,
        savesAvgExpr,
        savesTotalExpr,
        demosPrimaryExpr,
        demosAvgExpr,
        demosTotalExpr
      }),
      [...values, normalizedPlayerId]
    );

    return jsonCached(c, {
      mode,
      rows: result.rows.map((row) => ({
        season: row.season,
        games: Number(row.games ?? 0),
        seriesPlayed: Number(row.series_played ?? 0),
        goals: Number(row.goals ?? 0),
        goalsAvg: Number(row.goals_avg ?? 0),
        goalsTotal: Number(row.goals_total ?? 0),
        assists: Number(row.assists ?? 0),
        assistsAvg: Number(row.assists_avg ?? 0),
        assistsTotal: Number(row.assists_total ?? 0),
        saves: Number(row.saves ?? 0),
        savesAvg: Number(row.saves_avg ?? 0),
        savesTotal: Number(row.saves_total ?? 0),
        demos: Number(row.demos ?? 0),
        demosAvg: Number(row.demos_avg ?? 0),
        demosTotal: Number(row.demos_total ?? 0)
      }))
    });
  } catch (error) {
    console.error(error);
    return errorJson(c, 500, "Failed to load season performance");
  }
}
