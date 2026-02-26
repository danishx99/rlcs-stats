import { type IncomingMessage, type ServerResponse } from "node:http";
import { pool } from "../db";
import { json } from "../utils/http";
import { formatSql, loadSql } from "../utils/sql";
import { metricExpression, resolveStatOption } from "../utils/stats";
import { playerKeyExpr } from "../utils/roster";

const detailSql = loadSql("../../sql/events/detail.sql", import.meta.url);
const topTeamsSql = loadSql("../../sql/events/top-teams.sql", import.meta.url);
const statsTopSql = loadSql("../../sql/stats/top.sql", import.meta.url);
const bracketSql = loadSql("../../sql/events/bracket.sql", import.meta.url);

const LEADERBOARD_METRICS = ["rating", "goals", "demos", "saves", "assists"];
const DEFAULT_TEAMS_LIMIT = 8;
const MAX_TEAMS_LIMIT = 256;

export async function handleEventDetail(_req: IncomingMessage, res: ServerResponse, eventName: string, url: URL) {
  const decoded = decodeURIComponent(eventName);
  const season = url.searchParams.get("season")?.trim() || null;
  const split = url.searchParams.get("split")?.trim() || null;
  const teamsLimitRaw = Number.parseInt(url.searchParams.get("teamsLimit") ?? "", 10);
  const teamsLimit = Number.isFinite(teamsLimitRaw) && teamsLimitRaw > 0
    ? Math.min(teamsLimitRaw, MAX_TEAMS_LIMIT)
    : DEFAULT_TEAMS_LIMIT;

  try {
    const leaderboardQueries = LEADERBOARD_METRICS.map((key) => {
      const option = resolveStatOption(key);
      const where = `WHERE LOWER(TRIM(s."Event")) = LOWER($1)
        AND ($2::text IS NULL OR LOWER(TRIM(s."Season")) = LOWER($2))
        AND ($3::text IS NULL OR LOWER(TRIM(s."Split")) = LOWER($3))`;
      const valueExpr = metricExpression(option, "avg", "player_scope");
      const sql = formatSql(statsTopSql, {
        playerKeyExpr: playerKeyExpr("s"),
        where,
        valueExpr,
        havingClause: "",
        sortDir: "DESC",
        limitParam: "$4"
      });
      return { key, option, sql };
    });

    const [detailResult, teamsResult, ...leaderboardResults] = await Promise.all([
      pool.query(
        formatSql(detailSql, { playerKeyExpr: playerKeyExpr("s") }),
        [decoded, season, split]
      ),
      pool.query(topTeamsSql, [decoded, season, split, teamsLimit]),
      ...leaderboardQueries.map((q) => pool.query(q.sql, [decoded, season, split, 10]))
    ]);

    const detail = detailResult.rows[0];
    if (!detail || !detail.event_name) {
      json(res, 404, { error: "Event not found" });
      return;
    }

    const leaderboards = leaderboardQueries.map((q, i) => ({
      mode: "avg" as const,
      metric: {
        key: q.option!.key,
        label: q.option!.label,
        format: q.option!.format
      },
      rows: leaderboardResults[i].rows.map((row) => ({
        id: row.id,
        label: row.label,
        teams: row.teams ?? [],
        photoUrl: row.photo_url ?? null,
        country: row.country ?? null,
        value: Number(row.value ?? 0)
      }))
    }));

    const bracketSeason = (detail.season as string | null) ?? season;
    const bracketSplit = (detail.split as string | null) ?? split;
    let bracketRow: { bracket_image_url: string | null; liquipedia_url: string | null } | null = null;
    if (bracketSeason && bracketSplit && detail.event_name) {
      const bracketResult = await pool.query(bracketSql, [bracketSeason, bracketSplit, detail.event_name]);
      bracketRow = (bracketResult.rows[0] as { bracket_image_url: string | null; liquipedia_url: string | null } | undefined) ?? null;
    }

    json(res, 200, {
      event: {
        name: detail.event_name,
        season: detail.season,
        split: detail.split,
        minDate: detail.min_date,
        maxDate: detail.max_date,
        totalSeries: Number(detail.total_series ?? 0),
        totalPlayers: Number(detail.total_players ?? 0)
      },
      teams: teamsResult.rows.map((row) => ({
        team: row.team,
        deepRound: row.deep_round ?? null,
        roundDepth: Number(row.round_depth ?? 0),
        wonDeepest: row.won_deepest === true,
        placementStart: Number(row.placement_start ?? 0),
        placementEnd: Number(row.placement_end ?? 0),
        logoUrl: row.logo_url ?? null
      })),
      bracket:
        bracketRow?.bracket_image_url && bracketRow?.liquipedia_url
          ? {
              imageUrl: bracketRow.bracket_image_url,
              liquipediaUrl: bracketRow.liquipedia_url
            }
          : null,
      leaderboards
    });
  } catch (error) {
    console.error(error);
    json(res, 500, { error: "Failed to load event detail" });
  }
}
