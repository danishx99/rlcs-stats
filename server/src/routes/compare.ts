import { type IncomingMessage, type ServerResponse } from "node:http";
import { pool } from "../db";
import { json } from "../utils/http";
import { buildFilterClauses, normalizeMode, parseListParam } from "../utils/filters";
import { DEFAULT_COMPARE_STATS, metricExpression, resolveStatOptionAsync } from "../utils/stats";
import type { StatOption } from "../types";
import { formatSql, loadSql } from "../utils/sql";
import { playerKeyExpr, rosterCtes } from "../utils/roster";
const comparePlayersSql = loadSql("../../sql/compare/compare_players.sql", import.meta.url);
const compareTeamsSql = loadSql("../../sql/compare/compare_teams.sql", import.meta.url);
const compareRostersSql = loadSql("../../sql/compare/compare_rosters.sql", import.meta.url);
const historyPlayersSql = loadSql("../../sql/compare/history_players.sql", import.meta.url);
const historyRostersSql = loadSql("../../sql/compare/history_rosters.sql", import.meta.url);

export async function handleCompare(_req: IncomingMessage, res: ServerResponse, url: URL) {
  const type = url.searchParams.get("type") ?? "players";
  const ids = parseListParam(url.searchParams.get("ids"));
  const metricsRaw = parseListParam(url.searchParams.get("metrics"));
  const mode = normalizeMode(url.searchParams.get("mode"));

  if (!ids.length) {
    json(res, 400, { error: "ids is required" });
    return;
  }

  const metrics = metricsRaw.length ? metricsRaw : DEFAULT_COMPARE_STATS;
  const resolved = await Promise.all(metrics.map((key) => resolveStatOptionAsync(key)));
  const options = resolved.filter((option): option is StatOption => Boolean(option));

  if (!options.length) {
    json(res, 400, { error: "No valid metrics" });
    return;
  }

  if (type === "rosters") {
    const { clauses, values } = buildFilterClauses(url.searchParams, "s");
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const idsIndex = values.length + 1;
    const metricSelect = options
      .map((option) => `${metricExpression(option, mode, "roster_scope")} AS "${option.key}"`)
      .join(",\n            ");

    try {
      const result = await pool.query(
        formatSql(compareRostersSql, {
          rosterCtes: rosterCtes(where),
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
      json(res, 500, { error: "Failed to compare rosters" });
      return;
    }
  }

  if (type === "teams") {
    const { clauses, values } = buildFilterClauses(url.searchParams, "s");
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const idsIndex = values.length + 1;
    const metricSelect = options
      .map((option) => `${metricExpression(option, mode, "base")} AS "${option.key}"`)
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
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const idsIndex = values.length + 1;
  const metricSelect = options
    .map((option) => `${metricExpression(option, mode, "player_scope")} AS "${option.key}"`)
    .join(",\n            ");

  try {
    const result = await pool.query(
      formatSql(comparePlayersSql, {
        where,
        playerKeyExpr: playerKeyExpr("s"),
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

  if (ids.length < 2) {
    json(res, 200, { rows: [] });
    return;
  }

  const { clauses, values } = buildFilterClauses(url.searchParams, "s");
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const idsIndex = values.length + 1;

  try {
    if (type === "rosters") {
      const result = await pool.query(
        formatSql(historyRostersSql, {
          rosterCtes: rosterCtes(where),
          idsParam: `$${idsIndex}`
        }),
        [...values, ids]
      );

      json(res, 200, { rows: result.rows });
      return;
    }

    const result = await pool.query(
      formatSql(historyPlayersSql, {
        where,
        playerKeyExpr: playerKeyExpr("s"),
        idsParam: `$${idsIndex}`
      }),
      [...values, ids]
    );

    json(res, 200, { rows: result.rows });
  } catch (error) {
    console.error(error);
    json(res, 500, { error: "Failed to load compare history" });
  }
}
