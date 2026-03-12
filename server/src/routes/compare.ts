import { type IncomingMessage, type ServerResponse } from "node:http";
import { pool } from "../db";
import { json } from "../utils/http";
import { buildFilterClauses, normalizeMode, parseListParam } from "../utils/filters";
import { DEFAULT_COMPARE_STATS, getAllStatOptions, metricExpression, shouldUseGameDenominatorForTeamAvg } from "../utils/stats";
import type { StatOption } from "../types";
import { formatSql, loadSql } from "../utils/sql";
import { playerKeyExpr } from "../utils/roster";
const comparePlayersSql = loadSql("../../sql/compare/compare_players.sql", import.meta.url);
const compareTeamsSql = loadSql("../../sql/compare/compare_teams.sql", import.meta.url);
const compareRostersSql = loadSql("../../sql/compare/compare_rosters.sql", import.meta.url);
const historyPlayersSql = loadSql("../../sql/compare/history_players.sql", import.meta.url);
const historyRostersSql = loadSql("../../sql/compare/history_rosters.sql", import.meta.url);
const DEFAULT_HISTORY_LIMIT = 5;
const MAX_HISTORY_LIMIT = 50;
const MAX_COMPARE_IDS = 6;

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
  const type = url.searchParams.get("type") ?? "players";
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

  if (type === "rosters") {
    const { clauses, values } = buildFilterClauses(url.searchParams, "s");
    const filterClauses = clauses.length ? `AND ${clauses.join(" AND ")}` : "";
    const idsIndex = values.length + 1;
    const rosterGameCountExpr = 'COUNT(DISTINCT (roster_scope.series_id, roster_scope."Game Number"))';
    const metricSelect = options
      .map((option) => {
        const perGameDenominator =
          mode === "avg" && shouldUseGameDenominatorForTeamAvg(option)
            ? rosterGameCountExpr
            : undefined;
        return `${metricExpression(option, mode, "roster_scope", perGameDenominator)} AS "${option.key}"`;
      })
      .join(",\n            ");

    try {
      const result = await pool.query(
        formatSql(compareRostersSql, {
          idsParam: `$${idsIndex}`,
          metricSelect,
          filterClauses
        }),
        [...values, ids]
      );

      json(res, 200, {
        mode,
        metrics: options.map((option) => ({ key: option.key, label: option.label })),
        rows: result.rows.map((row) => ({
          id: row.id,
          label: row.label,
          games: Number(row.games ?? 0),
          values: options.reduce((acc, option) => {
            acc[option.key] = Number(row[option.key] ?? 0);
            return acc;
          }, {} as Record<string, number>)
        }))
      });
      return;
    } catch (error) {
      console.error(error);
      json(res, 500, { error: "Failed to compare rosters" });
      return;
    }
  }

  if (type === "teams") {
    const { clauses, values } = buildFilterClauses(url.searchParams, "s");
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const idsIndex = values.length + 1;
    const teamGameCountExpr = 'COUNT(DISTINCT (base.series_id, base."Game Number"))';
    const metricSelect = options
      .map((option) => {
        const perGameDenominator =
          mode === "avg" && shouldUseGameDenominatorForTeamAvg(option)
            ? teamGameCountExpr
            : undefined;
        return `${metricExpression(option, mode, "base", perGameDenominator)} AS "${option.key}"`;
      })
      .join(",\n            ");

    try {
      const result = await pool.query(
        formatSql(compareTeamsSql, {
          where,
          idsParam: `$${idsIndex}`,
          metricSelect
        }),
        [...values, ids]
      );

      json(res, 200, {
        mode,
        metrics: options.map((option) => ({ key: option.key, label: option.label })),
        rows: result.rows.map((row) => ({
          id: row.id,
          label: row.label,
          games: Number(row.games ?? 0),
          values: options.reduce((acc, option) => {
            acc[option.key] = Number(row[option.key] ?? 0);
            return acc;
          }, {} as Record<string, number>)
        }))
      });
      return;
    } catch (error) {
      console.error(error);
      json(res, 500, { error: "Failed to compare teams" });
      return;
    }
  }

  const { clauses, values } = buildFilterClauses(url.searchParams, "s");
  const filterClauses = clauses.length ? `AND ${clauses.join(" AND ")}` : "";
  const idsIndex = values.length + 1;
  const metricSelect = options
    .map((option) => `${metricExpression(option, mode, "player_scope")} AS "${option.key}"`)
    .join(",\n            ");

  try {
    const result = await pool.query(
      formatSql(comparePlayersSql, {
        playerKeyExpr: playerKeyExpr("s"),
        idsParam: `$${idsIndex}`,
        metricSelect,
        filterClauses
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
        games: Number(row.games ?? 0),
        values: options.reduce((acc, option) => {
          acc[option.key] = Number(row[option.key] ?? 0);
          return acc;
        }, {} as Record<string, number>)
      }))
    });
  } catch (error) {
    console.error(error);
    json(res, 500, { error: "Failed to compare players" });
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
    if (type === "rosters") {
      const { clauses, values } = buildFilterClauses(url.searchParams, "s");
      const filterClauses = clauses.length ? `AND ${clauses.join(" AND ")}` : "";
      const idsIndex = values.length + 1;
      const limitIndex = idsIndex + 1;
      const offsetIndex = idsIndex + 2;

      const result = await pool.query(
        formatSql(historyRostersSql, {
          idsParam: `$${idsIndex}`,
          filterClauses,
          limitParam: `$${limitIndex}`,
          offsetParam: `$${offsetIndex}`
        }),
        [...values, ids, limit, offset]
      );

      const total = Number(result.rows[0]?.total_count ?? 0);
      const rows = result.rows.filter((row) => row.series_id !== null).map((row) => {
        const { total_count, ...rest } = row as Record<string, unknown>;
        return rest;
      });
      json(res, 200, { rows, total, limit, offset });
      return;
    }

    const { clauses, values } = buildFilterClauses(url.searchParams, "s");
    const idsIndex = values.length + 1;
    const limitIndex = idsIndex + 1;
    const offsetIndex = idsIndex + 2;
    const filterClauses = clauses.length ? `AND ${clauses.join(" AND ")}` : "";
    const result = await pool.query(
      formatSql(historyPlayersSql, {
        filterClauses,
        playerKeyExpr: playerKeyExpr("s"),
        idsParam: `$${idsIndex}`,
        limitParam: `$${limitIndex}`,
        offsetParam: `$${offsetIndex}`
      }),
      [...values, ids, limit, offset]
    );

    const total = Number(result.rows[0]?.total_count ?? 0);
    const rows = result.rows.filter((row) => row.series_id !== null).map((row) => {
      const { total_count, ...rest } = row as Record<string, unknown>;
      return rest;
    });
    json(res, 200, { rows, total, limit, offset });
  } catch (error) {
    console.error(error);
    json(res, 500, { error: "Failed to load compare history" });
  }
}
