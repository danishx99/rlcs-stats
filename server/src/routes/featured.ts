import { type IncomingMessage, type ServerResponse } from "node:http";
import { pool } from "../db";
import { json } from "../utils/http";
import { buildFilterClauses } from "../utils/filters";
import { FEATURED_INSIGHTS } from "../utils/stats";

export async function handleFeatured(_req: IncomingMessage, res: ServerResponse, url: URL) {
  const insightKey = url.searchParams.get("metric") ?? "least_grounded";
  const limit = Math.min(Number.parseInt(url.searchParams.get("limit") ?? "6", 10), 20);
  const insight = FEATURED_INSIGHTS.find((item) => item.key === insightKey) ?? FEATURED_INSIGHTS[0];

  if (!insight) {
    json(res, 400, { error: "Invalid metric" });
    return;
  }

  const { clauses, values } = buildFilterClauses(url.searchParams, "s");
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const limitIndex = values.length + 1;

  try {
    const result = await pool.query(insight.sql(where, limitIndex), [...values, limit]);

    json(res, 200, {
      generatedAt: new Date().toISOString(),
      mode: "avg",
      metric: { key: insight.key, label: insight.label, format: insight.format },
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
    json(res, 500, { error: "Failed to load featured players" });
  }
}
