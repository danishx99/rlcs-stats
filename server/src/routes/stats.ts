import { type IncomingMessage, type ServerResponse } from "node:http";
import { pool } from "../db";
import { json } from "../utils/http";
import { buildFilterClauses, normalizeMode } from "../utils/filters";
import { metricExpression, resolveStatOptionAsync } from "../utils/stats";
import { formatSql, loadSql } from "../utils/sql";
import { playerKeyExpr } from "../utils/roster";
const statsTopSql = loadSql("../../sql/stats/top.sql", import.meta.url);

export async function handleStatsTop(_req: IncomingMessage, res: ServerResponse, url: URL) {
  const metricKey = url.searchParams.get("metric") ?? "score";
  const mode = normalizeMode(url.searchParams.get("mode"));
  const limit = Math.min(Number.parseInt(url.searchParams.get("limit") ?? "10", 10), 50);
  const option = await resolveStatOptionAsync(metricKey);

  if (!option) {
    json(res, 400, { error: "Invalid metric" });
    return;
  }

  const { clauses, values } = buildFilterClauses(url.searchParams, "s");
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const valueExpr = metricExpression(option, mode, "player_scope");

  const minSeries = Number.parseInt(url.searchParams.get("minSeries") ?? "0", 10);
  let havingClause = "";
  if (minSeries > 0) {
    values.push(String(minSeries));
    havingClause = `HAVING COUNT(DISTINCT "player_scope".series_id) >= $${values.length}`;
  }

  const minGames = Number.parseInt(url.searchParams.get("minGames") ?? "0", 10);
  if (minGames > 0) {
    values.push(String(minGames));
    const cond = `COUNT(*) >= $${values.length}`;
    havingClause = havingClause ? `${havingClause} AND ${cond}` : `HAVING ${cond}`;
  }

  const limitIndex = values.length + 1;

  try {
    const result = await pool.query(
      formatSql(statsTopSql, {
        playerKeyExpr: playerKeyExpr("s"),
        where,
        valueExpr,
        havingClause,
        limitParam: `$${limitIndex}`
      }),
      [...values, limit]
    );

    json(res, 200, {
      generatedAt: new Date().toISOString(),
      mode,
      metric: { key: option.key, label: option.label, format: option.format },
      rows: result.rows.map((row) => ({
        id: row.id,
        label: row.label,
        teams: row.teams ?? [],
        photoUrl: row.photo_url,
        country: row.country,
        value: Number(row.value ?? 0)
      }))
    });
  } catch (error) {
    console.error(error);
    json(res, 500, { error: "Failed to load leaderboard" });
  }
}
