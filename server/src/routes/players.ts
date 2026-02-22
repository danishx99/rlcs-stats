import { type IncomingMessage, type ServerResponse } from "node:http";
import { pool } from "../db";
import { json } from "../utils/http";
import { buildFilterClauses, normalizeMode } from "../utils/filters";
import { metricExpression, resolveStatOption } from "../utils/stats";
import { formatSql, loadSql } from "../utils/sql";
import { playerKeyExpr } from "../utils/roster";
const playersListSql = loadSql("../../sql/players/list.sql", import.meta.url);
const playerSeasonSql = loadSql("../../sql/players/season.sql", import.meta.url);
const playerProfileSql = loadSql("../../sql/players/profile.sql", import.meta.url);
const playerResultsSql = loadSql("../../sql/players/results.sql", import.meta.url);

export async function handlePlayers(_req: IncomingMessage, res: ServerResponse, url: URL) {
  const { clauses, values } = buildFilterClauses(url.searchParams, "s");
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const limit = Math.min(Number.parseInt(url.searchParams.get("limit") ?? "20", 10), 100);
  const offset = Number.parseInt(url.searchParams.get("offset") ?? "0", 10);
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

    json(res, 200, {
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
    json(res, 500, { error: "Failed to load players" });
  }
}

export async function handlePlayerProfile(
  _req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  playerId: string
) {
  const { clauses, values } = buildFilterClauses(url.searchParams, "s");
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const playerIndex = values.length + 1;

  try {
    const result = await pool.query(
      formatSql(playerProfileSql, {
        playerKeyExpr: playerKeyExpr("s"),
        where,
        playerIdParam: `$${playerIndex}`
      }),
      [...values, playerId]
    );

    if (!result.rows.length || !result.rows[0].player_found) {
      json(res, 404, { error: "Player not found" });
      return;
    }

    const row = result.rows[0];
    const debutParts = [row.debut_season, row.debut_split, row.debut_event].filter(Boolean);
    const debut = debutParts.length ? debutParts.join(" / ") : null;

    json(res, 200, {
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
        bestResult: row.best_result,
        twitch: row.twitch,
        tiktok: row.tiktok,
        teams: row.teams ?? [],
        games: Number(row.games ?? 0),
        seriesPlayed: Number(row.series_played ?? 0),
        totals: {
          goals: Number(row.goals_total ?? 0),
          assists: Number(row.assists_total ?? 0),
          saves: Number(row.saves_total ?? 0),
          demos: Number(row.demos_total ?? 0)
        },
        averages: {
          goals: Number(row.goals_avg ?? 0),
          assists: Number(row.assists_avg ?? 0),
          saves: Number(row.saves_avg ?? 0),
          demos: Number(row.demos_avg ?? 0)
        }
      }
    });
  } catch (error) {
    console.error(error);
    json(res, 500, { error: "Failed to load player profile" });
  }
}

export async function handlePlayerResults(
  _req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  playerId: string
) {
  const { clauses, values } = buildFilterClauses(url.searchParams, "s");
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const playerIndex = values.length + 1;

  try {
    const result = await pool.query(
      formatSql(playerResultsSql, {
        playerKeyExpr: playerKeyExpr("s"),
        where,
        playerIdParam: `$${playerIndex}`
      }),
      [...values, playerId]
    );

    const seasons: string[] = result.rows.length
      ? (result.rows[0].available_seasons ?? [])
      : [];

    const events = result.rows.map((row) => ({
      season: row.season,
      split: row.split,
      event: row.event,
      placement: row.placement ?? null,
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

    json(res, 200, { seasons, events });
  } catch (error) {
    console.error(error);
    json(res, 500, { error: "Failed to load player results" });
  }
}

export async function handlePlayerSeason(
  _req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  playerId: string
) {
  const { clauses, values } = buildFilterClauses(url.searchParams, "s");
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const mode = normalizeMode(url.searchParams.get("mode"));
  const playerIndex = values.length + 1;

  const goalsExpr = metricExpression(resolveStatOption("goals"), mode, "player_scope");
  const assistsExpr = metricExpression(resolveStatOption("assists"), mode, "player_scope");
  const savesExpr = metricExpression(resolveStatOption("saves"), mode, "player_scope");
  const demosExpr = metricExpression(resolveStatOption("demos"), mode, "player_scope");

  try {
    const result = await pool.query(
      formatSql(playerSeasonSql, {
        playerKeyExpr: playerKeyExpr("s"),
        where,
        playerIdParam: `$${playerIndex}`,
        goalsExpr,
        assistsExpr,
        savesExpr,
        demosExpr
      }),
      [...values, playerId]
    );

    json(res, 200, {
      mode,
      rows: result.rows.map((row) => ({
        season: row.season,
        games: Number(row.games ?? 0),
        seriesPlayed: Number(row.series_played ?? 0),
        goals: Number(row.goals ?? 0),
        assists: Number(row.assists ?? 0),
        saves: Number(row.saves ?? 0),
        demos: Number(row.demos ?? 0)
      }))
    });
  } catch (error) {
    console.error(error);
    json(res, 500, { error: "Failed to load season performance" });
  }
}
