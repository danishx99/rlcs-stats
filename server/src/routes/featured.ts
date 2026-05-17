import type { Context } from "hono";
import { pool } from "../db";
import { errorJson, jsonCached } from "../utils/responses";
import { buildFilterClauses } from "../utils/filters";
import { FEATURED_INSIGHTS } from "../utils/stats";

export async function handleFeatured(c: Context) {
  const params = new URLSearchParams(c.req.query());
  const insightKey = c.req.query("metric") ?? "least_grounded";
  const limit = Math.min(Number.parseInt(c.req.query("limit") ?? "6", 10), 20);
  const insight = FEATURED_INSIGHTS.find((item) => item.key === insightKey) ?? FEATURED_INSIGHTS[0];

  if (!insight) {
    return errorJson(c, 400, "Invalid metric");
  }

  const { clauses, values } = buildFilterClauses(params, "s");
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const limitIndex = values.length + 1;

  try {
    const result = await pool.query(insight.sql(where, limitIndex), [...values, limit]);

    const extraColumns = insight.columns ?? [];
    const extraKeys = extraColumns.map((col) => col.key);

    return jsonCached(c, {
      generatedAt: new Date().toISOString(),
      mode: "avg",
      metric: { key: insight.key, label: insight.label, format: insight.format },
      columns: extraColumns,
      rows: result.rows.map((row) => {
        const extras: Record<string, number> = {};
        for (const key of extraKeys) {
          if (row[key] != null) extras[key] = Number(row[key]);
        }
        return {
          id: row.id,
          label: row.label,
          teams: row.teams ?? [],
          value: Number(row.value ?? 0),
          photoUrl: row.photo_url ?? null,
          extras
        };
      })
    });
  } catch (error) {
    console.error(error);
    return errorJson(c, 500, "Failed to load featured players");
  }
}
