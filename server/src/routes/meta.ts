import { type IncomingMessage, type ServerResponse } from "node:http";
import { pool } from "../db";
import { json } from "../utils/http";
import { normalizeFilter } from "../utils/filters";
import { FEATURED_INSIGHTS, STAT_OPTIONS } from "../utils/stats";
import { formatSql, loadSql } from "../utils/sql";

const seasonsSql = loadSql("../../sql/meta/seasons.sql", import.meta.url);
const splitsSql = loadSql("../../sql/meta/splits.sql", import.meta.url);
const eventsSql = loadSql("../../sql/meta/events.sql", import.meta.url);

export async function handleMeta(_req: IncomingMessage, res: ServerResponse, url: URL) {
  try {
    const seasonFilter = normalizeFilter(url.searchParams.get("season"));
    const splitFilter = normalizeFilter(url.searchParams.get("split"));
    const splitParams = seasonFilter ? [seasonFilter] : [];
    const splitWhere = seasonFilter ? "AND LOWER(TRIM(\"Season\")) = LOWER($1)" : "";

    const eventParams: string[] = [];
    let eventWhere = "";
    if (seasonFilter) {
      eventWhere += ` AND LOWER(TRIM("Season")) = LOWER($${eventParams.length + 1})`;
      eventParams.push(seasonFilter);
    }
    if (splitFilter) {
      eventWhere += ` AND LOWER(TRIM("Split")) = LOWER($${eventParams.length + 1})`;
      eventParams.push(splitFilter);
    }

    const [seasons, splits, events] = await Promise.all([
      pool.query(seasonsSql),
      pool.query(formatSql(splitsSql, { where: splitWhere }), splitParams),
      pool.query(formatSql(eventsSql, { where: eventWhere }), eventParams)
    ]);

    json(res, 200, {
      generatedAt: new Date().toISOString(),
      seasons: seasons.rows.map((row) => row.value).filter(Boolean),
      splits: splits.rows.map((row) => row.value).filter(Boolean),
      events: events.rows.map((row) => row.value).filter(Boolean),
      statOptions: STAT_OPTIONS.map(({ key, label, format }) => ({
        key,
        label,
        format
      })),
      featuredOptions: FEATURED_INSIGHTS.map(({ key, label, format }) => ({
        key,
        label,
        format
      }))
    });
  } catch (error) {
    console.error(error);
    json(res, 500, { error: "Failed to load metadata" });
  }
}
