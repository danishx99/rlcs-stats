import { type IncomingMessage, type ServerResponse } from "node:http";
import { pool } from "../db";
import { json } from "../utils/http";
import { buildFilterClauses, normalizeMode } from "../utils/filters";
import { metricExpression, resolveStatOptionAsync, shouldUseGameDenominatorForTeamAvg } from "../utils/stats";
import { formatSql, loadSql } from "../utils/sql";
import { playerKeyExpr } from "../utils/roster";
const statsTopSql = loadSql("../../sql/stats/top.sql", import.meta.url);
const statsTopTeamSql = loadSql("../../sql/stats/top-team.sql", import.meta.url);

export async function handleStatsTop(_req: IncomingMessage, res: ServerResponse, url: URL) {
  const metricKey = url.searchParams.get("metric") ?? "score";
  const mode = normalizeMode(url.searchParams.get("mode"));
  const type = url.searchParams.get("type") === "team" ? "team" : "player";
  const sortDir = url.searchParams.get("sort") === "asc" ? "ASC" : "DESC";
  const limit = Math.min(Number.parseInt(url.searchParams.get("limit") ?? "10", 10), 50);
  const option = await resolveStatOptionAsync(metricKey);

  if (!option) {
    json(res, 400, { error: "Invalid metric" });
    return;
  }

  const { clauses, values } = buildFilterClauses(url.searchParams, "s");
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

  const minSeries = Number.parseInt(url.searchParams.get("minSeries") ?? "0", 10);
  let minSeriesIndex = 0;
  if (minSeries > 0) {
    values.push(String(minSeries));
    minSeriesIndex = values.length;
  }

  const minGames = Number.parseInt(url.searchParams.get("minGames") ?? "0", 10);
  let minGamesIndex = 0;
  if (minGames > 0) {
    values.push(String(minGames));
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
      const valueExpr = metricExpression(option, mode, "team_scope", teamAvgGameCountExpr);
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
        valueExpr,
        havingClause: teamHaving,
        sortDir,
        limitParam: `$${limitIndex}`
      });
      mapRow = (row) => ({
        id: row.id,
        label: row.label,
        teams: [],
        value: Number(row.value ?? 0)
      });
    } else {
      const valueExpr = metricExpression(option, mode, "player_scope");
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
        valueExpr,
        havingClause: playerHaving,
        sortDir,
        limitParam: `$${limitIndex}`
      });
      mapRow = (row) => ({
        id: row.id,
        label: row.label,
        teams: row.teams ?? [],
        photoUrl: row.photo_url,
        country: row.country,
        value: Number(row.value ?? 0)
      });
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
