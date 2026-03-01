import { type IncomingMessage, type ServerResponse } from "node:http";
import { pool } from "../db";
import { json } from "../utils/http";
import { buildFilterClauses, normalizeMode } from "../utils/filters";
import { metricExpression, resolveStatOption } from "../utils/stats";
import { formatSql, loadSql } from "../utils/sql";
const rosterSeasonSql = loadSql("../../sql/rosters/season.sql", import.meta.url);
const rosterProfileSql = loadSql("../../sql/rosters/profile.sql", import.meta.url);

function normalizeTeamGroupId(rawId: string) {
  let decoded = rawId;
  try {
    decoded = decodeURIComponent(rawId);
  } catch {
    decoded = rawId;
  }
  decoded = decoded.trim();
  if (!decoded) return decoded;
  if (decoded.startsWith("org:") || decoded.startsWith("roster:")) {
    return decoded;
  }
  return `roster:${decoded}`;
}

export async function handleRosterProfile(
  _req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  rosterId: string
) {
  const rosterKey = normalizeTeamGroupId(rosterId);
  const { clauses, values } = buildFilterClauses(url.searchParams, "s");
  const where = clauses.length ? `AND ${clauses.join(" AND ")}` : "";
  const rosterIndex = values.length + 1;

  try {
    const result = await pool.query(
      formatSql(rosterProfileSql, {
        rosterIdParam: `$${rosterIndex}`,
        where
      }),
      [...values, rosterKey]
    );

    if (!result.rows.length) {
      json(res, 404, { error: "Roster not found" });
      return;
    }

    const row = result.rows[0];
    const debutParts = [row.debut_season, row.debut_split, row.debut_event].filter(Boolean);
    const debut = debutParts.length ? debutParts.join(" / ") : null;

    json(res, 200, {
      roster: {
        id: row.roster_id,
        name: row.roster_name,
        logoUrl: row.logo_url ?? null,
        twitter: row.twitter ?? null,
        tiktok: row.tiktok ?? null,
        youtube: row.youtube ?? null,
        twitch: row.twitch ?? null,
        starters: row.starters ?? [],
        alternates: row.alternates ?? [],
        currentRoster: row.starters ?? [],
        currentAlternates: row.alternates ?? [],
        defaultSeason: row.default_season ?? null,
        seasonsCompeted: row.seasons_competed ?? [],
        seasonRosters: row.season_rosters ?? [],
        otherTeamNames: row.other_team_names ?? [],
        debut,
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
  const rosterKey = normalizeTeamGroupId(rosterId);
  const { clauses, values } = buildFilterClauses(url.searchParams, "s");
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const mode = normalizeMode(url.searchParams.get("mode"));
  const rosterIndex = values.length + 1;

  const gameCount = `COUNT(DISTINCT (roster_scope.series_id, roster_scope."Game"))`;
  const goalsExpr = metricExpression(resolveStatOption("goals"), mode, "roster_scope", gameCount);
  const assistsExpr = metricExpression(resolveStatOption("assists"), mode, "roster_scope", gameCount);
  const savesExpr = metricExpression(resolveStatOption("saves"), mode, "roster_scope", gameCount);
  const demosExpr = metricExpression(resolveStatOption("demos"), mode, "roster_scope", gameCount);

  try {
    const result = await pool.query(
      formatSql(rosterSeasonSql, {
        where,
        rosterIdParam: `$${rosterIndex}`,
        goalsExpr,
        assistsExpr,
        savesExpr,
        demosExpr
      }),
      [...values, rosterKey]
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
