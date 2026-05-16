import { type IncomingMessage, type ServerResponse } from "node:http";
import { pool } from "../db";
import { json } from "../utils/http";
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

function parseHistoryPagination(url: URL) {
  const limitRaw = Number.parseInt(url.searchParams.get("limit") ?? "", 10);
  const offsetRaw = Number.parseInt(url.searchParams.get("offset") ?? "", 10);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0
    ? Math.min(limitRaw, MAX_HISTORY_LIMIT)
    : DEFAULT_HISTORY_LIMIT;
  const offset = Number.isFinite(offsetRaw) && offsetRaw >= 0 ? offsetRaw : 0;
  return { limit, offset };
}

export async function handleCompare(_req: IncomingMessage, res: ServerResponse, url: URL) {
  const type = (url.searchParams.get("type") ?? "players") as CompareType;
  const ids = parseListParam(url.searchParams.get("ids"));
  const metricsRaw = parseListParam(url.searchParams.get("metrics"));
  const mode = normalizeMode(url.searchParams.get("mode"));

  if (!ids.length) {
    json(res, 400, { error: "ids is required" });
    return;
  }
  if (ids.length > MAX_COMPARE_IDS) {
    json(res, 400, { error: `A maximum of ${MAX_COMPARE_IDS} ids is allowed` });
    return;
  }

  const metrics = metricsRaw.length ? metricsRaw : DEFAULT_COMPARE_STATS;
  const allStatOptions = await getAllStatOptions();
  const optionByKey = new Map(allStatOptions.map((option) => [option.key, option] as const));
  const options = metrics
    .map((key) => optionByKey.get(key))
    .filter((option): option is StatOption => Boolean(option));

  if (!options.length) {
    json(res, 400, { error: "No valid metrics" });
    return;
  }

  const { clauses, values } = buildFilterClauses(url.searchParams, "s");
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
      json(res, 200, {
        mode,
        metrics: options.map((option) => ({ key: option.key, label: option.label })),
        rows: result.rows.map((row) => ({
          id: row.id,
          label: row.label,
          games: toNumber(row.games),
          values: buildMetricValuesRow(row, options)
        }))
      });
      return;
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
      json(res, 200, {
        mode,
        metrics: options.map((option) => ({ key: option.key, label: option.label })),
        rows: result.rows.map((row) => ({
          id: row.id,
          label: row.label,
          games: toNumber(row.games),
          values: buildMetricValuesRow(row, options)
        }))
      });
      return;
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
    json(res, 200, {
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
    json(res, 500, { error: `Failed to compare ${type}` });
  }
}

export async function handleCompareHistory(
  _req: IncomingMessage,
  res: ServerResponse,
  url: URL
) {
  const type = url.searchParams.get("type") ?? "players";
  const ids = parseListParam(url.searchParams.get("ids"));
  const { limit, offset } = parseHistoryPagination(url);

  if (ids.length < 2) {
    json(res, 200, { rows: [], total: 0, limit, offset });
    return;
  }
  if (ids.length > MAX_COMPARE_IDS) {
    json(res, 400, { error: `A maximum of ${MAX_COMPARE_IDS} ids is allowed` });
    return;
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
      searchParams: url.searchParams,
      sqlTemplate: queryConfig.sqlTemplate,
      ids,
      limit,
      offset,
      execute: (sql, params) => pool.query(sql, params),
      extraSqlTokens: queryConfig.extraSqlTokens
    });

    json(res, 200, { rows, total, limit, offset });
  } catch (error) {
    console.error(error);
    json(res, 500, { error: "Failed to load compare history" });
  }
}
