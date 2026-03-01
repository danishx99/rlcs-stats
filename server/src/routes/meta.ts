import { type IncomingMessage, type ServerResponse } from "node:http";
import { pool } from "../db";
import { json } from "../utils/http";
import { buildFilterClauses } from "../utils/filters";
import { categorizeStatOptions, FEATURED_INSIGHTS, getAllStatOptions, STAT_OPTIONS } from "../utils/stats";
import { formatSql, loadSql } from "../utils/sql";

const seasonsSql = loadSql("../../sql/meta/seasons.sql", import.meta.url);
const splitsSql = loadSql("../../sql/meta/splits.sql", import.meta.url);
const eventsSql = loadSql("../../sql/meta/events.sql", import.meta.url);
const eventsInternationalSql = loadSql("../../sql/meta/events-international.sql", import.meta.url);
const modesSql = loadSql("../../sql/meta/modes.sql", import.meta.url);
const scopesSql = loadSql("../../sql/meta/scopes.sql", import.meta.url);
const tiersSql = loadSql("../../sql/meta/tiers.sql", import.meta.url);

function toWhere(clauses: string[]) {
  return clauses.length ? `AND ${clauses.join(" AND ")}` : "";
}

export async function handleMeta(_req: IncomingMessage, res: ServerResponse, url: URL) {
  try {
    const seasonFilters = buildFilterClauses(url.searchParams, "", ["gameMode", "scope", "tier"]);
    const splitFilters = buildFilterClauses(url.searchParams, "", ["season", "gameMode", "scope", "tier"]);
    // Event selectors should include all events for the selected season/split/mode,
    // including LAN events, regardless of scope/tier filtering in data queries.
    const eventFilters = buildFilterClauses(url.searchParams, "", ["season", "split", "gameMode"]);
    const modeFilters = buildFilterClauses(url.searchParams, "", ["season", "split", "event", "scope", "tier"]);
    const scopeFilters = buildFilterClauses(url.searchParams, "", ["season", "split", "event", "gameMode", "tier"]);
    const tierFilters = buildFilterClauses(url.searchParams, "", ["season", "split", "event", "gameMode", "scope"]);

    const [seasons, splits, events, internationalEvents, modes, scopes, tiers] = await Promise.all([
      pool.query(formatSql(seasonsSql, { where: toWhere(seasonFilters.clauses) }), seasonFilters.values),
      pool.query(formatSql(splitsSql, { where: toWhere(splitFilters.clauses) }), splitFilters.values),
      pool.query(formatSql(eventsSql, { where: toWhere(eventFilters.clauses) }), eventFilters.values),
      pool.query(formatSql(eventsInternationalSql, { where: toWhere(eventFilters.clauses) }), eventFilters.values),
      pool.query(formatSql(modesSql, { where: toWhere(modeFilters.clauses) }), modeFilters.values),
      pool.query(formatSql(scopesSql, { where: toWhere(scopeFilters.clauses) }), scopeFilters.values),
      pool.query(formatSql(tiersSql, { where: toWhere(tierFilters.clauses) }), tierFilters.values)
    ]);

    json(res, 200, {
      generatedAt: new Date().toISOString(),
      seasons: seasons.rows.map((row) => row.value).filter(Boolean),
      splits: splits.rows.map((row) => row.value).filter(Boolean),
      events: events.rows.map((row) => row.value).filter(Boolean),
      internationalEvents: internationalEvents.rows.map((row) => row.value).filter(Boolean),
      modes: modes.rows.map((row) => row.value).filter(Boolean),
      scopes: scopes.rows.map((row) => row.value).filter(Boolean),
      tiers: tiers.rows.map((row) => row.value).filter(Boolean),
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

export async function handleMetaColumns(_req: IncomingMessage, res: ServerResponse) {
  try {
    const options = await getAllStatOptions();
    const categories = categorizeStatOptions(options);
    json(res, 200, {
      categories: categories.map((cat) => ({
        name: cat.name,
        stats: cat.stats.map(({ key, label, format }) => ({ key, label, format }))
      }))
    });
  } catch (error) {
    console.error(error);
    json(res, 500, { error: "Failed to load column metadata" });
  }
}
