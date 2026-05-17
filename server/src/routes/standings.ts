import type { Context } from "hono";
import { pool } from "../db";
import { errorJson, jsonCached } from "../utils/responses";

export async function handleStandings(c: Context) {
  try {
    const seasonsResult = await pool.query(
      "SELECT DISTINCT season FROM standings ORDER BY season"
    );
    const seasons: string[] = seasonsResult.rows.map((r) => r.season);

    if (seasons.length === 0) {
      return jsonCached(c, { seasons: [], season: "", rows: [] });
    }

    const season = c.req.query("season") || seasons[seasons.length - 1];

    const result = await pool.query(
      `SELECT s.rank, s.team_name, s.points,
        (SELECT tp."Logo Link" FROM team_profiles tp
         WHERE UPPER(tp."Team Name") = UPPER(s.team_name)
         LIMIT 1) AS logo_url
       FROM standings s WHERE s.season = $1 ORDER BY s.rank`,
      [season]
    );

    return jsonCached(c, {
      seasons,
      season,
      rows: result.rows.map((r) => ({
        rank: r.rank,
        teamName: r.team_name,
        points: r.points,
        logoUrl: r.logo_url ?? null
      }))
    });
  } catch (error) {
    console.error(error);
    return errorJson(c, 500, "Failed to load standings");
  }
}
