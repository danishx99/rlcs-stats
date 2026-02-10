import { type IncomingMessage, type ServerResponse } from "node:http";
import { pool } from "../db";
import { json } from "../utils/http";

export async function handleStandings(_req: IncomingMessage, res: ServerResponse, url: URL) {
  try {
    const seasonsResult = await pool.query(
      "SELECT DISTINCT season FROM standings ORDER BY season"
    );
    const seasons: string[] = seasonsResult.rows.map((r) => r.season);

    if (seasons.length === 0) {
      json(res, 200, { seasons: [], season: "", rows: [] });
      return;
    }

    const season = url.searchParams.get("season") || seasons[seasons.length - 1];

    const result = await pool.query(
      "SELECT rank, team_name, points FROM standings WHERE season = $1 ORDER BY rank",
      [season]
    );

    json(res, 200, {
      seasons,
      season,
      rows: result.rows.map((r) => ({
        rank: r.rank,
        teamName: r.team_name,
        points: r.points
      }))
    });
  } catch (error) {
    console.error(error);
    json(res, 500, { error: "Failed to load standings" });
  }
}
