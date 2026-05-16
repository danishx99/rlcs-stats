import { type IncomingMessage, type ServerResponse } from "node:http";
import { pool } from "../db";
import { json } from "../utils/http";
import { formatSql, loadSql } from "../utils/sql";
import { metricExpression, resolveStatOption } from "../utils/stats";
import { parseEventQueryIntent } from "../utils/query-intent";
import { mapPlayerLeaderboardRow } from "../utils/leaderboard-rows";

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
  const intent = parseEventQueryIntent(url, {
    teamsLimit: DEFAULT_TEAMS_LIMIT,
    maxTeamsLimit: MAX_TEAMS_LIMIT
  });
  const { teamsLimit, leaderboardMode, selectedPhase, selectedDay, arena: arenaParam } = intent;

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

    // WHERE template and all SQL placeholders are identical across the 5 metrics —
    // only the per-metric value expressions change. Build them once outside the loop.
    const leaderboardWhere = `WHERE s."Event" = $1
        AND ($2::text IS NULL OR s."Season" = $2)
        AND ($3::text IS NULL OR s."Split" = $3)
        AND ($4::text IS NULL OR s."mode" = $4)
        AND ($5::text IS NULL OR s."scope" = $5)
        AND ($6::text IS NULL OR s."tier" = $6)
        AND ($7::text = 'all' OR LOWER(TRIM(COALESCE(s."Stage", ''))) = LOWER($7))
        AND ($8::text = 'all' OR LOWER(TRIM(COALESCE(s."Day"::text, ''))) = LOWER($8))
        AND ($9::text IS NULL OR s."Arena" = $9)`;
    const leaderboardSharedSqlParts = {
      playerKeyExpr: `s."Unique ID"`,
      where: leaderboardWhere,
      havingClause: "",
      sortDir: "DESC",
      limitParam: "$10"
    } as const;

    const leaderboardQueries = LEADERBOARD_METRICS.map((key) => {
      const option = resolveStatOption(key);
      const primaryValueExpr = metricExpression(option, leaderboardMode, "player_scope");
      const avgValueExpr = metricExpression(option, "avg", "player_scope");
      const totalValueExpr = metricExpression(option, "total", "player_scope");
      const sql = formatSql(statsTopSql, {
        ...leaderboardSharedSqlParts,
        primaryValueExpr,
        avgValueExpr,
        totalValueExpr
      });
      return { key, option, sql };
    });

    const effectiveTeamsLimit = detail.status === "in_progress" ? MAX_TEAMS_LIMIT : teamsLimit;
    const [teamsResult, phasesResult, daysResult, ...leaderboardResults] = await Promise.all([
      pool.query(topTeamsSql, [eventName, season, split, mode, scope, tier, effectiveTeamsLimit]),
      pool.query(phasesSql, [eventName, season, split, mode, scope, tier]),
      pool.query(daysSql, [eventName, season, split, mode, scope, tier]),
      ...leaderboardQueries.map((q) =>
        pool.query(q.sql, [eventName, season, split, mode, scope, tier, selectedPhase, selectedDay, arenaParam, 10])
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
      rows: leaderboardResults[i].rows.map((row) =>
        mapPlayerLeaderboardRow(row, {
          teamsFallback: [],
          normalizeNullables: true
        })
      )
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
