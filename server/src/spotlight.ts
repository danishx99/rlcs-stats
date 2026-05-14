import { pool } from "./db";
import { playerKeyExpr } from "./utils/roster";
import { getAllStatOptions, metricExpression, resolveStatOption } from "./utils/stats";
import type { StatOption } from "./types";

export const DEFAULT_SPOTLIGHT_KEYS = new Set(["goals", "assists", "saves", "demos"]);
export const SPOTLIGHT_MAX_CUSTOM = 8;

export type SpotlightStat = {
  key: string;
  total: number | null;
  avg: number | null;
  rankTotal: number | null;
  rankAvg: number | null;
};

export function parseSpotlightParam(raw: string | null): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const entry of raw.split(",")) {
    const key = entry.trim();
    if (!key) continue;
    if (DEFAULT_SPOTLIGHT_KEYS.has(key)) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(key);
  }
  return result;
}

function aliasFor(key: string) {
  return `k_${key.replace(/[^a-zA-Z0-9_]/g, "_")}`;
}

export async function resolveSpotlightStats(
  playerId: string,
  keys: string[]
): Promise<SpotlightStat[]> {
  if (!keys.length) return [];

  const catalog = await getAllStatOptions();
  const catalogByKey = new Map(catalog.map((option) => [option.key, option]));

  const resolved: { key: string; option: StatOption; alias: string }[] = [];
  for (const key of keys) {
    if (DEFAULT_SPOTLIGHT_KEYS.has(key)) continue;
    const option = catalogByKey.get(key) ?? resolveStatOption(key);
    if (!option) continue;
    resolved.push({ key, option, alias: aliasFor(key) });
    if (resolved.length >= SPOTLIGHT_MAX_CUSTOM) break;
  }
  if (!resolved.length) return [];

  const aggSelects: string[] = [`${playerKeyExpr("s")} AS player_key`];
  const rankSelects: string[] = ["player_key"];

  for (const { option, alias } of resolved) {
    const totalExpr = metricExpression(option, "total", "s");
    const avgExpr = metricExpression(option, "avg", "s");
    aggSelects.push(`${totalExpr} AS ${alias}_total`);
    aggSelects.push(`${avgExpr} AS ${alias}_avg`);
    rankSelects.push(`${alias}_total`);
    rankSelects.push(`${alias}_avg`);
    rankSelects.push(
      `RANK() OVER (ORDER BY ${alias}_total DESC NULLS LAST) AS ${alias}_rank_total`
    );
    rankSelects.push(
      `RANK() OVER (ORDER BY ${alias}_avg DESC NULLS LAST) AS ${alias}_rank_avg`
    );
  }

  const playerSelects: string[] = [];
  for (const { alias } of resolved) {
    playerSelects.push(`${alias}_total`);
    playerSelects.push(`${alias}_avg`);
    playerSelects.push(`${alias}_rank_total`);
    playerSelects.push(`${alias}_rank_avg`);
  }

  const sql = `
    WITH player_aggregates AS (
      SELECT ${aggSelects.join(",\n        ")}
      FROM stats s
      WHERE LOWER(TRIM("mode")) = '3s'
        AND "Team" IS NOT NULL
        AND TRIM("Team") <> ''
        AND ${playerKeyExpr("s")} IS NOT NULL
      GROUP BY ${playerKeyExpr("s")}
    ),
    ranked AS (
      SELECT ${rankSelects.join(",\n        ")}
      FROM player_aggregates
    )
    SELECT ${playerSelects.join(", ")}
    FROM ranked
    WHERE player_key = $1
  `;

  const result = await pool.query(sql, [playerId]);
  const row = result.rows[0];

  return resolved.map(({ key, alias }) => {
    if (!row) {
      return { key, total: null, avg: null, rankTotal: null, rankAvg: null };
    }
    const totalRaw = row[`${alias}_total`];
    const avgRaw = row[`${alias}_avg`];
    const rankTotalRaw = row[`${alias}_rank_total`];
    const rankAvgRaw = row[`${alias}_rank_avg`];
    return {
      key,
      total: totalRaw == null ? null : Number(totalRaw),
      avg: avgRaw == null ? null : Number(avgRaw),
      rankTotal: rankTotalRaw == null ? null : Number(rankTotalRaw),
      rankAvg: rankAvgRaw == null ? null : Number(rankAvgRaw)
    };
  });
}
