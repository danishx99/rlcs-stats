import { type IncomingMessage, type ServerResponse } from "node:http";
import { pool } from "../db";
import { json } from "../utils/http";
import { metricExpression, resolveStatOptionAsync, shouldUseGameDenominatorForTeamAvg } from "../utils/stats";
import { formatSql, loadSql } from "../utils/sql";
import { playerKeyExpr } from "../utils/roster";
import { parseStatsTopIntent } from "../utils/query-intent";
import { mapPlayerLeaderboardRow, mapTeamLeaderboardRow } from "../utils/leaderboard-rows";
const statsTopSql = loadSql("../../sql/stats/top.sql", import.meta.url);
const statsTopTeamSql = loadSql("../../sql/stats/top-team.sql", import.meta.url);

export async function handleStatsTop(_req: IncomingMessage, res: ServerResponse, url: URL) {
  const intent = parseStatsTopIntent(url);
  const { metricKey, mode, type, sortDir, limit } = intent;
  const option = await resolveStatOptionAsync(metricKey);

  if (!option) {
    json(res, 400, { error: "Invalid metric" });
    return;
  }

  const clauses = [...intent.clauses];
  const values: Array<string | number> = [...intent.values];
  const ssaOnly = intent.ssaOnly;
  if (ssaOnly && type === "player") {
    clauses.push(`s."Unique ID" LIKE 'SSA-%'`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

  const minSeries = intent.minSeries;
  let minSeriesIndex = 0;
  if (minSeries > 0) {
    values.push(minSeries);
    minSeriesIndex = values.length;
  }

  const minGames = intent.minGames;
  let minGamesIndex = 0;
  if (minGames > 0) {
    values.push(minGames);
    minGamesIndex = values.length;
  }

  const limitIndex = values.length + 1;

  try {
    let query: string;
    let mapRow: (row: Record<string, unknown>) => Record<string, unknown>;

    if (type === "team") {
      const gameCountExpr = 'COUNT(DISTINCT (team_scope.series_id, team_scope."Game Number"))';
      const teamAvgGameCountExpr =
        mode === "avg" && shouldUseGameDenominatorForTeamAvg(option) ? gameCountExpr : undefined;
      const primaryValueExpr = metricExpression(option, mode, "team_scope", teamAvgGameCountExpr);
      const avgValueExpr = metricExpression(
        option,
        "avg",
        "team_scope",
        shouldUseGameDenominatorForTeamAvg(option) ? gameCountExpr : undefined
      );
      const totalValueExpr = metricExpression(option, "total", "team_scope");
      const teamHavingConds: string[] = [];
      if (minSeriesIndex > 0) {
        teamHavingConds.push(`COUNT(DISTINCT team_scope.series_id) >= $${minSeriesIndex}`);
      }
      if (minGamesIndex > 0) {
        teamHavingConds.push(`${gameCountExpr} >= $${minGamesIndex}`);
      }
      const teamHaving = teamHavingConds.length ? `HAVING ${teamHavingConds.join(" AND ")}` : "";
      query = formatSql(statsTopTeamSql, {
        where,
        primaryValueExpr,
        avgValueExpr,
        totalValueExpr,
        havingClause: teamHaving,
        sortDir,
        limitParam: `$${limitIndex}`
      });
      mapRow = (row) => mapTeamLeaderboardRow(row, { teamsFallback: [] });
    } else {
      const primaryValueExpr = metricExpression(option, mode, "player_scope");
      const avgValueExpr = metricExpression(option, "avg", "player_scope");
      const totalValueExpr = metricExpression(option, "total", "player_scope");
      const playerHavingConds: string[] = [];
      if (minSeriesIndex > 0) {
        playerHavingConds.push(`COUNT(DISTINCT player_scope.series_id) >= $${minSeriesIndex}`);
      }
      if (minGamesIndex > 0) {
        playerHavingConds.push(`COUNT(*) >= $${minGamesIndex}`);
      }
      const playerHaving = playerHavingConds.length ? `HAVING ${playerHavingConds.join(" AND ")}` : "";
      query = formatSql(statsTopSql, {
        playerKeyExpr: playerKeyExpr("s"),
        where,
        primaryValueExpr,
        avgValueExpr,
        totalValueExpr,
        havingClause: playerHaving,
        sortDir,
        limitParam: `$${limitIndex}`
      });
      mapRow = (row) => mapPlayerLeaderboardRow(row, { teamsFallback: [] });
    }

    const result = await pool.query(query, [...values, limit]);

    json(res, 200, {
      generatedAt: new Date().toISOString(),
      mode,
      metric: { key: option.key, label: option.label, format: option.format },
      rows: result.rows.map(mapRow)
    });
  } catch (error) {
    console.error(error);
    json(res, 500, { error: "Failed to load leaderboard" });
  }
}
