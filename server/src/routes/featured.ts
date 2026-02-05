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

    const extraColumns = insight.columns ?? [];
    const extraKeys = extraColumns.map((col) => col.key);

    json(res, 200, {
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
    json(res, 500, { error: "Failed to load featured players" });
  }
}
