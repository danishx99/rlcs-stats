import { type IncomingMessage, type ServerResponse } from "node:http";
import { pool } from "../db";
import { json } from "../utils/http";
import { formatSql, loadSql } from "../utils/sql";
import { getAllStatOptions } from "../utils/stats";
import { playerKeyExpr, rosterCtes } from "../utils/roster";
const playersSql = loadSql("../../sql/search/players.sql", import.meta.url);
const rostersSql = loadSql("../../sql/search/rosters.sql", import.meta.url);

export async function handleSearch(_req: IncomingMessage, res: ServerResponse, url: URL) {
  const query = url.searchParams.get("q") ?? "";
  const limit = Math.min(Number.parseInt(url.searchParams.get("limit") ?? "8", 10), 25);
  const trimmed = query.trim();

  if (!trimmed) {
    json(res, 200, { players: [], rosters: [], stats: [] });
    return;
  }

  try {
    const like = `%${trimmed}%`;
    const statOptions = await getAllStatOptions();
    const statsResults = statOptions
      .filter((option) => `${option.label} ${option.key}`.toLowerCase().includes(trimmed.toLowerCase()))
      .slice(0, limit)
      .map((option) => ({
        id: option.key,
        label: option.label,
        type: "stat"
      }));

    const playersResult = await pool.query(
      formatSql(playersSql, {
        playerKeyExpr: playerKeyExpr("s")
      }),
      [like, limit]
    );

    const rostersResult = await pool.query(
      formatSql(rostersSql, {
        rosterCtes: rosterCtes("")
      }),
      [like, limit]
    );

    json(res, 200, {
      players: playersResult.rows.map((row) => ({
        id: row.id,
        label: row.label,
        type: "player",
        meta: {
          photoUrl: row.photo_url,
          country: row.country
        }
      })),
      rosters: rostersResult.rows.map((row) => ({
        id: row.id,
        label: row.label,
        type: "roster",
        meta: {
          starters: row.starters ?? []
        }
      })),
      stats: statsResults
    });
  } catch (error) {
    console.error(error);
    json(res, 500, { error: "Search failed" });
  }
}
