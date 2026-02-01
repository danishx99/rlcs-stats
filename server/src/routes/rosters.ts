import { type IncomingMessage, type ServerResponse } from "node:http";
import { pool } from "../db";
import { json } from "../utils/http";
import { buildFilterClauses, normalizeMode } from "../utils/filters";
import { metricExpression, resolveStatOption } from "../utils/stats";
import { formatSql, loadSql } from "../utils/sql";
import { rosterCtes } from "../utils/roster";
const rosterSeasonSql = loadSql("../../sql/rosters/season.sql", import.meta.url);
const rosterProfileSql = loadSql("../../sql/rosters/profile.sql", import.meta.url);

export async function handleRosterProfile(
  _req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  rosterId: string
) {
  const { clauses, values } = buildFilterClauses(url.searchParams, "s");
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const rosterIndex = values.length + 1;

  try {
    const result = await pool.query(
      formatSql(rosterProfileSql, {
        rosterCtes: rosterCtes(where),
        rosterIdParam: `$${rosterIndex}`
      }),
      [...values, rosterId]
    );

    if (!result.rows.length) {
      json(res, 404, { error: "Roster not found" });
      return;
    }

    const row = result.rows[0];

    json(res, 200, {
      roster: {
        id: row.roster_id,
        name: row.roster_name,
        starters: row.starters ?? [],
        alternates: row.alternates ?? [],
        debut: row.debut_date,
        bestResult: row.best_result,
        games: Number(row.games ?? 0),
        seriesPlayed: Number(row.series_played ?? 0),
        totals: {
          goals: Number(row.goals_total ?? 0),
          assists: Number(row.assists_total ?? 0),
          saves: Number(row.saves_total ?? 0),
          demos: Number(row.demos_total ?? 0)
        },
        averages: {
          goals: Number(row.goals_avg ?? 0),
          assists: Number(row.assists_avg ?? 0),
          saves: Number(row.saves_avg ?? 0),
          demos: Number(row.demos_avg ?? 0)
        }
      }
    });
  } catch (error) {
    console.error(error);
    json(res, 500, { error: "Failed to load roster profile" });
  }
}

export async function handleRosterSeason(
  _req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  rosterId: string
) {
  const { clauses, values } = buildFilterClauses(url.searchParams, "s");
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const mode = normalizeMode(url.searchParams.get("mode"));
  const rosterIndex = values.length + 1;

  const goalsExpr = metricExpression(resolveStatOption("goals"), mode, "roster_scope");
  const assistsExpr = metricExpression(resolveStatOption("assists"), mode, "roster_scope");
  const savesExpr = metricExpression(resolveStatOption("saves"), mode, "roster_scope");
  const demosExpr = metricExpression(resolveStatOption("demos"), mode, "roster_scope");

  try {
    const result = await pool.query(
      formatSql(rosterSeasonSql, {
        rosterCtes: rosterCtes(where),
        rosterIdParam: `$${rosterIndex}`,
        goalsExpr,
        assistsExpr,
        savesExpr,
        demosExpr
      }),
      [...values, rosterId]
    );

    json(res, 200, {
      mode,
      rows: result.rows.map((row) => ({
        season: row.season,
        games: Number(row.games ?? 0),
        seriesPlayed: Number(row.series_played ?? 0),
        goals: Number(row.goals ?? 0),
        assists: Number(row.assists ?? 0),
        saves: Number(row.saves ?? 0),
        demos: Number(row.demos ?? 0)
      }))
    });
  } catch (error) {
    console.error(error);
    json(res, 500, { error: "Failed to load season performance" });
  }
}
