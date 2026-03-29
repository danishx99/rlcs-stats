import { type IncomingMessage, type ServerResponse } from "node:http";
import { pool } from "../db";
import { json } from "../utils/http";
import { normalizeMode } from "../utils/filters";
import { normalizeDay, normalizePhase } from "../utils/phases";
import { formatSql, loadSql } from "../utils/sql";
import { metricExpression, resolveStatOption } from "../utils/stats";

const detailSql = loadSql("../../sql/events/detail.sql", import.meta.url);
const topTeamsSql = loadSql("../../sql/events/top-teams.sql", import.meta.url);
const statsTopSql = loadSql("../../sql/stats/top.sql", import.meta.url);
const bracketSql = loadSql("../../sql/events/bracket.sql", import.meta.url);
const phasesSql = loadSql("../../sql/events/phases.sql", import.meta.url);
const daysSql = loadSql("../../sql/events/days.sql", import.meta.url);

const LEADERBOARD_METRICS = ["rating", "goals", "demos", "saves", "assists"];
const DEFAULT_TEAMS_LIMIT = 8;
const MAX_TEAMS_LIMIT = 256;

export async function handleEventDetail(_req: IncomingMessage, res: ServerResponse, eventId: string, url: URL) {
  const decodedEventId = decodeURIComponent(eventId).trim().toLowerCase();
  if (!decodedEventId) {
    json(res, 400, { error: "Event id is required" });
    return;
  }
  const teamsLimitRaw = Number.parseInt(url.searchParams.get("teamsLimit") ?? "", 10);
  const teamsLimit = Number.isFinite(teamsLimitRaw) && teamsLimitRaw > 0
    ? Math.min(teamsLimitRaw, MAX_TEAMS_LIMIT)
    : DEFAULT_TEAMS_LIMIT;
  const leaderboardMode = normalizeMode(url.searchParams.get("mode"));
  const selectedPhase = normalizePhase(url.searchParams.get("phase"));
  const selectedDay = normalizeDay(url.searchParams.get("day"));

  try {
    const detailResult = await pool.query(
      detailSql,
      [decodedEventId]
    );
    const detail = detailResult.rows[0];
    if (!detail || !detail.event_name) {
      json(res, 404, { error: "Event not found" });
      return;
    }

    const season = typeof detail.season === "string" ? detail.season : null;
    const split = typeof detail.split === "string" ? detail.split : null;
    const mode = typeof detail.mode === "string" ? detail.mode : null;
    const scope = typeof detail.scope === "string" ? detail.scope : null;
    const tier = typeof detail.tier === "string" ? detail.tier : null;
    const eventName = typeof detail.event_name === "string" ? detail.event_name : null;

    if (!eventName || !season || !split || !mode || !scope || !tier) {
      json(res, 404, { error: "Event is missing canonical track metadata" });
      return;
    }

    const leaderboardQueries = LEADERBOARD_METRICS.map((key) => {
      const option = resolveStatOption(key);
      const where = `WHERE LOWER(TRIM(s."Event")) = LOWER($1)
        AND ($2::text IS NULL OR LOWER(TRIM(s."Season")) = LOWER($2))
        AND ($3::text IS NULL OR LOWER(TRIM(s."Split")) = LOWER($3))
        AND ($4::text IS NULL OR LOWER(TRIM(s."mode")) = LOWER($4))
        AND ($5::text IS NULL OR LOWER(TRIM(s."scope")) = LOWER($5))
        AND ($6::text IS NULL OR LOWER(TRIM(s."tier")) = LOWER($6))
        AND ($7::text = 'all' OR LOWER(TRIM(COALESCE(s."Stage", ''))) = LOWER($7))
        AND ($8::text = 'all' OR LOWER(TRIM(COALESCE(s."Day"::text, ''))) = LOWER($8))`;
      const primaryValueExpr = metricExpression(option, leaderboardMode, "player_scope");
      const avgValueExpr = metricExpression(option, "avg", "player_scope");
      const totalValueExpr = metricExpression(option, "total", "player_scope");
      const sql = formatSql(statsTopSql, {
        playerKeyExpr: `NULLIF(TRIM(s."Unique ID"), '')`,
        where,
        primaryValueExpr,
        avgValueExpr,
        totalValueExpr,
        havingClause: "",
        sortDir: "DESC",
        limitParam: "$9"
      });
      return { key, option, sql };
    });

    const effectiveTeamsLimit = detail.status === "in_progress" ? MAX_TEAMS_LIMIT : teamsLimit;
    const [teamsResult, phasesResult, daysResult, ...leaderboardResults] = await Promise.all([
      pool.query(topTeamsSql, [eventName, season, split, mode, scope, tier, effectiveTeamsLimit]),
      pool.query(phasesSql, [eventName, season, split, mode, scope, tier]),
      pool.query(daysSql, [eventName, season, split, mode, scope, tier]),
      ...leaderboardQueries.map((q) =>
        pool.query(q.sql, [eventName, season, split, mode, scope, tier, selectedPhase, selectedDay, 10])
      )
    ]);
    const phases = phasesResult.rows
      .map((row) => (typeof row.phase === "string" ? row.phase : ""))
      .filter(Boolean);
    const days = daysResult.rows
      .map((row) => (typeof row.day === "string" ? row.day : ""))
      .filter(Boolean);

    const leaderboards = leaderboardQueries.map((q, i) => ({
      mode: leaderboardMode,
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
        value: Number(row.value ?? 0),
        avgValue: Number(row.avg_value ?? 0),
        totalValue: Number(row.total_value ?? 0)
      }))
    }));

    const bracketSeason = season;
    const bracketSplit = split;
    let bracketRow: { bracket_image_url: string | null; liquipedia_url: string | null } | null = null;
    if (bracketSeason && bracketSplit && eventName) {
      const bracketResult = await pool.query(bracketSql, [bracketSeason, bracketSplit, eventName]);
      bracketRow = (bracketResult.rows[0] as { bracket_image_url: string | null; liquipedia_url: string | null } | undefined) ?? null;
    }

    json(res, 200, {
      event: {
        id: detail.event_id,
        name: detail.event_name,
        season: detail.season,
        split: detail.split,
        mode: detail.mode ?? null,
        scope: detail.scope ?? null,
        tier: detail.tier ?? null,
        minDate: detail.min_date,
        maxDate: detail.max_date,
        totalSeries: Number(detail.total_series ?? 0),
        totalPlayers: Number(detail.total_players ?? 0),
        status: detail.status ?? "completed"
      },
      teams: teamsResult.rows.map((row) => ({
        team: row.team,
        uniqueId: row.unique_id ?? null,
        deepRound: row.deep_round ?? null,
        roundDepth: Number(row.round_depth ?? 0),
        wonDeepest: row.won_deepest === true,
        isEliminated: row.is_eliminated === true,
        placementStart: Number(row.placement_start ?? 0),
        placementEnd: Number(row.placement_end ?? 0),
        logoUrl: row.logo_url ?? null,
        photoUrl: row.photo_url ?? null
      })),
      bracket:
        bracketRow?.bracket_image_url && bracketRow?.liquipedia_url
          ? {
              imageUrl: bracketRow.bracket_image_url,
              liquipediaUrl: bracketRow.liquipedia_url
            }
          : null,
      phases,
      days,
      selectedPhase,
      selectedDay,
      leaderboards
    });
  } catch (error) {
    console.error(error);
    json(res, 500, { error: "Failed to load event detail" });
  }
}
