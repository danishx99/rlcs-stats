import type { Context } from "hono";
import { pool } from "../db";
import { errorJson, jsonCached } from "../utils/responses";
import { buildFilterClauses, normalizeMode, parseListParam } from "../utils/filters";
import { DEFAULT_COMPARE_STATS, getAllStatOptions, metricExpression, shouldUseGameDenominatorForTeamAvg } from "../utils/stats";
import type { StatOption } from "../types";
import { formatSql, loadSql } from "../utils/sql";
import { playerKeyExpr } from "../utils/roster";
import { toNumber } from "../utils/response-mappers";
import { runCompareHistoryQuery } from "../utils/compare-history";
const comparePlayersSql = loadSql("../../sql/compare/compare_players.sql", import.meta.url);
const compareTeamsSql = loadSql("../../sql/compare/compare_teams.sql", import.meta.url);
const compareRostersSql = loadSql("../../sql/compare/compare_rosters.sql", import.meta.url);
const historyPlayersSql = loadSql("../../sql/compare/history_players.sql", import.meta.url);
const historyRostersSql = loadSql("../../sql/compare/history_rosters.sql", import.meta.url);
const DEFAULT_HISTORY_LIMIT = 5;
const MAX_HISTORY_LIMIT = 50;
const MAX_COMPARE_IDS = 6;
type CompareType = "players" | "teams" | "rosters";

function buildMetricValuesRow(row: Record<string, unknown>, options: StatOption[]) {
  return options.reduce((acc, option) => {
    acc[option.key] = toNumber(row[option.key]);
    return acc;
  }, {} as Record<string, number>);
}

function buildMetricSelect(
  options: StatOption[],
  mode: "avg" | "total",
  scope: "player_scope" | "team_scope" | "roster_scope" | "base",
  gameCountExpr?: string
) {
  return options
    .map((option) => {
      const perGameDenominator =
        mode === "avg" && gameCountExpr && shouldUseGameDenominatorForTeamAvg(option)
          ? gameCountExpr
          : undefined;
      return `${metricExpression(option, mode, scope, perGameDenominator)} AS "${option.key}"`;
    })
    .join(",\n            ");
}

function parseHistoryPagination(params: URLSearchParams) {
  const limitRaw = Number.parseInt(params.get("limit") ?? "", 10);
  const offsetRaw = Number.parseInt(params.get("offset") ?? "", 10);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0
    ? Math.min(limitRaw, MAX_HISTORY_LIMIT)
    : DEFAULT_HISTORY_LIMIT;
  const offset = Number.isFinite(offsetRaw) && offsetRaw >= 0 ? offsetRaw : 0;
  return { limit, offset };
}

export async function handleCompare(c: Context) {
  const params = new URLSearchParams(c.req.query());
  const type = (c.req.query("type") ?? "players") as CompareType;
  const ids = parseListParam(c.req.query("ids") ?? null);
  const metricsRaw = parseListParam(c.req.query("metrics") ?? null);
  const mode = normalizeMode(c.req.query("mode") ?? null);

  if (!ids.length) {
    return errorJson(c, 400, "ids is required");
  }
  if (ids.length > MAX_COMPARE_IDS) {
    return errorJson(c, 400, `A maximum of ${MAX_COMPARE_IDS} ids is allowed`);
  }

  const metrics = metricsRaw.length ? metricsRaw : DEFAULT_COMPARE_STATS;
  const allStatOptions = await getAllStatOptions();
  const optionByKey = new Map(allStatOptions.map((option) => [option.key, option] as const));
  const options = metrics
    .map((key) => optionByKey.get(key))
    .filter((option): option is StatOption => Boolean(option));

  if (!options.length) {
    return errorJson(c, 400, "No valid metrics");
  }

  const { clauses, values } = buildFilterClauses(params, "s");
  const idsIndex = values.length + 1;
  try {
    if (type === "rosters") {
      const result = await pool.query(
        formatSql(compareRostersSql, {
          idsParam: `$${idsIndex}`,
          metricSelect: buildMetricSelect(
            options,
            mode,
            "roster_scope",
            'COUNT(DISTINCT (roster_scope.series_id, roster_scope."Game Number"))'
          ),
          filterClauses: clauses.length ? `AND ${clauses.join(" AND ")}` : ""
        }),
        [...values, ids]
      );
      return jsonCached(c, {
        mode,
        metrics: options.map((option) => ({ key: option.key, label: option.label })),
        rows: result.rows.map((row) => ({
          id: row.id,
          label: row.label,
          games: toNumber(row.games),
          values: buildMetricValuesRow(row, options)
        }))
      });
    }

    if (type === "teams") {
      const result = await pool.query(
        formatSql(compareTeamsSql, {
          where: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "",
          idsParam: `$${idsIndex}`,
          metricSelect: buildMetricSelect(
            options,
            mode,
            "base",
            'COUNT(DISTINCT (base.series_id, base."Game Number"))'
          )
        }),
        [...values, ids]
      );
      return jsonCached(c, {
        mode,
        metrics: options.map((option) => ({ key: option.key, label: option.label })),
        rows: result.rows.map((row) => ({
          id: row.id,
          label: row.label,
          games: toNumber(row.games),
          values: buildMetricValuesRow(row, options)
        }))
      });
    }

    const result = await pool.query(
      formatSql(comparePlayersSql, {
        playerKeyExpr: playerKeyExpr("s"),
        idsParam: `$${idsIndex}`,
        metricSelect: buildMetricSelect(options, mode, "player_scope"),
        filterClauses: clauses.length ? `AND ${clauses.join(" AND ")}` : ""
      }),
      [...values, ids]
    );
    return jsonCached(c, {
      mode,
      metrics: options.map((option) => ({ key: option.key, label: option.label })),
      rows: result.rows.map((row) => ({
        id: row.id,
        label: row.label,
        teams: row.teams ?? [],
        games: toNumber(row.games),
        values: buildMetricValuesRow(row, options)
      }))
    });
  } catch (error) {
    console.error(error);
    return errorJson(c, 500, `Failed to compare ${type}`);
  }
}

export async function handleCompareHistory(c: Context) {
  const params = new URLSearchParams(c.req.query());
  const type = c.req.query("type") ?? "players";
  const ids = parseListParam(c.req.query("ids") ?? null);
  const { limit, offset } = parseHistoryPagination(params);

  if (ids.length < 2) {
    return jsonCached(c, { rows: [], total: 0, limit, offset });
  }
  if (ids.length > MAX_COMPARE_IDS) {
    return errorJson(c, 400, `A maximum of ${MAX_COMPARE_IDS} ids is allowed`);
  }

  try {
    const queryConfig =
      type === "rosters"
        ? { sqlTemplate: historyRostersSql }
        : {
          sqlTemplate: historyPlayersSql,
          extraSqlTokens: { playerKeyExpr: playerKeyExpr("s") }
        };

    const { rows, total } = await runCompareHistoryQuery({
      searchParams: params,
      sqlTemplate: queryConfig.sqlTemplate,
      ids,
      limit,
      offset,
      execute: (sql, params) => pool.query(sql, params),
      extraSqlTokens: queryConfig.extraSqlTokens
    });

    return jsonCached(c, { rows, total, limit, offset });
  } catch (error) {
    console.error(error);
    return errorJson(c, 500, "Failed to load compare history");
  }
}
