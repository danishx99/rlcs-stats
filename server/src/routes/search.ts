import { type IncomingMessage, type ServerResponse } from "node:http";
import { pool } from "../db";
import { json } from "../utils/http";
import { formatSql, loadSql } from "../utils/sql";
import { getAllStatOptions } from "../utils/stats";
import { playerKeyExpr, rosterCtes } from "../utils/roster";
const playersSql = loadSql("../../sql/search/players.sql", import.meta.url);
const rostersSql = loadSql("../../sql/search/rosters.sql", import.meta.url);
const teamsSql = loadSql("../../sql/search/teams.sql", import.meta.url);
const eventsSql = loadSql("../../sql/search/events.sql", import.meta.url);

export async function handleSearch(_req: IncomingMessage, res: ServerResponse, url: URL) {
  const query = url.searchParams.get("q") ?? "";
  const limit = Math.min(Number.parseInt(url.searchParams.get("limit") ?? "8", 10), 25);
  const trimmed = query.trim();

  if (!trimmed) {
    json(res, 200, { players: [], teams: [], rosters: [], stats: [], events: [] });
    return;
  }

  try {
    const like = `%${trimmed}%`;
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
          playerKeyExpr: playerKeyExpr("s")
        }),
        [like, limit]
      ),
      pool.query(
        formatSql(rostersSql, {
          rosterCtes: rosterCtes("")
        }),
        [like, limit]
      ),
      pool.query(eventsSql, [like, limit]),
      pool.query(teamsSql, [like, limit])
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

    json(res, 200, {
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
        id: row.label,
        label: row.label,
        type: "event",
        meta: {
          season: row.season,
          split: row.split
        }
      }))
    });
  } catch (error) {
    console.error(error);
    json(res, 500, { error: "Search failed" });
  }
}
