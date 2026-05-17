import type { Context } from "hono";
import { pool } from "../db";
import { errorJson, jsonCached } from "../utils/responses";
import { buildFilterClauses } from "../utils/filters";
import { formatSql, loadSql } from "../utils/sql";
import { getAllStatOptions } from "../utils/stats";
import { playerKeyExpr } from "../utils/roster";
const playersSql = loadSql("../../sql/search/players.sql", import.meta.url);
const rostersSql = loadSql("../../sql/search/rosters.sql", import.meta.url);
const teamsSql = loadSql("../../sql/search/teams.sql", import.meta.url);
const eventsSql = loadSql("../../sql/search/events.sql", import.meta.url);

export async function handleSearch(c: Context) {
  const query = c.req.query("q") ?? "";
  const limit = Math.min(Number.parseInt(c.req.query("limit") ?? "8", 10), 25);
  const trimmed = query.trim();

  if (!trimmed) {
    return jsonCached(c, { players: [], teams: [], rosters: [], stats: [], events: [] });
  }

  try {
    const like = `%${trimmed}%`;
    const { clauses, values } = buildFilterClauses(new URLSearchParams(c.req.query()), "s");
    const extraWhere = clauses.length ? `AND ${clauses.join(" AND ")}` : "";

    const eventsLikeIndex = values.length + 1;
    const eventsLimitIndex = eventsLikeIndex + 1;
    const teamsLikeIndex = values.length + 1;
    const teamsLimitIndex = teamsLikeIndex + 1;

    const [
      statOptions,
      playersResult,
      rostersResult,
      eventsResult,
      teamsResult
    ] = await Promise.all([
      getAllStatOptions(),
      pool.query(
        formatSql(playersSql, {
          playerKeyExpr: playerKeyExpr("s"),
          likeParam: "$1",
          limitParam: "$2"
        }),
        [like, limit]
      ),
      pool.query(
        formatSql(rostersSql, {
          likeParam: "$1",
          limitParam: "$2"
        }),
        [like, limit]
      ),
      pool.query(
        formatSql(eventsSql, {
          where: extraWhere,
          likeParam: `$${eventsLikeIndex}`,
          limitParam: `$${eventsLimitIndex}`
        }),
        [...values, like, limit]
      ),
      pool.query(
        formatSql(teamsSql, {
          where: extraWhere,
          likeParam: `$${teamsLikeIndex}`,
          limitParam: `$${teamsLimitIndex}`
        }),
        [...values, like, limit]
      )
    ]);

    const lowerTrimmed = trimmed.toLowerCase();

    const statsResults = statOptions
      .filter((option) => `${option.label} ${option.key}`.toLowerCase().includes(lowerTrimmed))
      .slice(0, limit)
      .map((option) => ({
        id: option.key,
        label: option.label,
        type: "stat"
      }));

    return jsonCached(c, {
      players: playersResult.rows.map((row) => ({
        id: row.id,
        label: row.label,
        type: "player",
        meta: {
          photoUrl: row.photo_url,
          country: row.country,
          realName: row.real_name
        }
      })),
      teams: teamsResult.rows.map((row) => ({
        id: row.id,
        label: row.label,
        type: "team",
        meta: {
          photoUrl: row.logo_url ?? null,
          starters: row.starters ?? []
        }
      })),
      rosters: rostersResult.rows.map((row) => ({
        id: row.id,
        label: row.label,
        type: "roster",
        meta: {
          photoUrl: row.logo_url ?? null,
          starters: row.starters ?? []
        }
      })),
      stats: statsResults,
      events: eventsResult.rows.map((row) => ({
        id: row.event_id,
        label: row.label,
        type: "event",
        meta: {
          season: row.season,
          split: row.split,
          mode: row.mode ?? null,
          scope: row.scope ?? null,
          tier: row.tier ?? null
        }
      }))
    });
  } catch (error) {
    console.error(error);
    return errorJson(c, 500, "Search failed");
  }
}
