import { type IncomingMessage, type ServerResponse } from "node:http";
import { pool } from "../db";
import { json, withRouteError } from "../utils/http";
import { buildFilterClauses, normalizeMode } from "../utils/filters";
import { metricExpression, resolveStatOption } from "../utils/stats";
import { formatSql, loadSql } from "../utils/sql";
import { normalizeTeamGroupId, normalizeTeamLabel } from "../utils/team-identity";
const rosterSeasonSql = loadSql("../../sql/rosters/season.sql", import.meta.url);
const rosterProfileSql = loadSql("../../sql/rosters/profile.sql", import.meta.url);
const rosterResultsSql = loadSql("../../sql/rosters/results.sql", import.meta.url);
const eventTopTeamsSql = loadSql("../../sql/events/top-teams.sql", import.meta.url);
const rosterFinalSeriesSql = loadSql("../../sql/rosters/final-series.sql", import.meta.url);

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

  await withRouteError(res, "Failed to load roster profile", async () => {
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
  });
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

  await withRouteError(res, "Failed to load season performance", async () => {
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
  });
}

export async function handleRosterResults(
  _req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  rosterId: string
) {
  const rosterKey = normalizeTeamGroupId(rosterId);
  const season = url.searchParams.get("season")?.trim();
  if (!season) {
    json(res, 400, { error: "season is required" });
    return;
  }

  const params = new URLSearchParams(url.searchParams);
  params.set("season", season);
  params.set("gameMode", "3s");
  const { clauses, values } = buildFilterClauses(params, "s");
  const where = clauses.length ? `AND ${clauses.join(" AND ")}` : "";
  const rosterIndex = values.length + 1;

  await withRouteError(res, "Failed to load roster results", async () => {
    const result = await pool.query(
      formatSql(rosterResultsSql, {
        rosterIdParam: `$${rosterIndex}`,
        where
      }),
      [...values, rosterKey]
    );

    const eventPlacementKey = (
      event: string,
      seasonValue: string,
      splitValue: string,
      scopeValue: string | null,
      tierValue: string | null
    ) => `${seasonValue}::${splitValue}::${event}::${scopeValue ?? "<null>"}::${tierValue ?? "<null>"}`;

    type RowMeta = {
      event: string | null;
      rowSeason: string | null;
      split: string | null;
      scope: string | null;
      tier: string | null;
      teamLabels: string[];
    };
    const rowMeta: RowMeta[] = result.rows.map((row) => ({
      event: typeof row.event === "string" ? row.event : null,
      rowSeason: typeof row.season === "string" ? row.season : null,
      split: typeof row.split === "string" ? row.split : null,
      scope: typeof row.scope === "string" ? row.scope : null,
      tier: typeof row.tier === "string" ? row.tier : null,
      teamLabels: Array.isArray(row.team_labels)
        ? row.team_labels.filter((value: unknown): value is string => typeof value === "string")
        : []
    }));

    // Batch top-teams lookups: dedupe by event key and fire all unique queries concurrently.
    type TopTeamsParams = { event: string; rowSeason: string; split: string; scope: string; tier: string | null };
    const topTeamsJobs = new Map<string, TopTeamsParams>();
    for (let i = 0; i < result.rows.length; i++) {
      const row = result.rows[i];
      if (row.scope !== "regional") continue;
      const { event, rowSeason, split, scope, tier } = rowMeta[i];
      if (!event || !rowSeason || !split || !scope) continue;
      const key = eventPlacementKey(event, rowSeason, split, scope, tier);
      if (!topTeamsJobs.has(key)) {
        topTeamsJobs.set(key, { event, rowSeason, split, scope, tier });
      }
    }

    const placementLookup = new Map<string, Map<string, string>>();
    await Promise.all(Array.from(topTeamsJobs.entries()).map(async ([key, { event, rowSeason, split, scope, tier }]) => {
      const teamsResult = await pool.query(eventTopTeamsSql, [event, rowSeason, split, "3s", scope, tier, 256]);
      const map = new Map<string, string>();
      for (const teamRow of teamsResult.rows) {
        const team = normalizeTeamLabel(teamRow.team);
        if (!team) continue;
        const start = Number(teamRow.placement_start ?? 0);
        const end = Number(teamRow.placement_end ?? 0);
        if (!start || !end) continue;
        map.set(team, start === end ? `Top ${start}` : `Top ${start}-${end}`);
      }
      placementLookup.set(key, map);
    }));

    // Batch final-series lookups: dedupe by event + sorted team labels, fire concurrently.
    type FinalSeriesParams = {
      event: string;
      rowSeason: string;
      split: string;
      scope: string | null;
      tier: string | null;
      teamLabels: string[];
    };
    type FinalSeriesResult = {
      opponent: string | null;
      playerWins: number;
      opponentWins: number;
      wonSeries: boolean;
    };
    const finalSeriesKey = (p: FinalSeriesParams) =>
      `${p.rowSeason}::${p.split}::${p.event}::${p.scope ?? "<null>"}::${p.tier ?? "<null>"}::${[...p.teamLabels].sort().join("|")}`;
    const finalSeriesJobs = new Map<string, FinalSeriesParams>();
    const finalSeriesKeyByRow: (string | null)[] = result.rows.map((_row, i) => {
      const { event, rowSeason, split, scope, tier, teamLabels } = rowMeta[i];
      if (!event || !rowSeason || !split || teamLabels.length === 0) return null;
      const params: FinalSeriesParams = { event, rowSeason, split, scope, tier, teamLabels };
      const key = finalSeriesKey(params);
      if (!finalSeriesJobs.has(key)) finalSeriesJobs.set(key, params);
      return key;
    });

    const finalSeriesLookup = new Map<string, FinalSeriesResult>();
    await Promise.all(Array.from(finalSeriesJobs.entries()).map(async ([key, p]) => {
      const finalSeriesResult = await pool.query(
        rosterFinalSeriesSql,
        [p.event, p.rowSeason, p.split, "3s", p.scope, p.tier, p.teamLabels]
      );
      const finalSeries = finalSeriesResult.rows[0];
      if (finalSeries) {
        finalSeriesLookup.set(key, {
          opponent: finalSeries.opponent ?? null,
          playerWins: Number(finalSeries.own_wins ?? 0),
          opponentWins: Number(finalSeries.opponent_wins ?? 0),
          wonSeries: Boolean(finalSeries.won_series)
        });
      }
    }));

    const enrichedRows = result.rows.map((row, i) => {
      const { event, rowSeason, split, scope, tier, teamLabels } = rowMeta[i];

      let opponent: string | null = null;
      let playerWins = 0;
      let opponentWins = 0;
      let wonSeries = false;

      const fsKey = finalSeriesKeyByRow[i];
      if (fsKey) {
        const cached = finalSeriesLookup.get(fsKey);
        if (cached) {
          opponent = cached.opponent;
          playerWins = cached.playerWins;
          opponentWins = cached.opponentWins;
          wonSeries = cached.wonSeries;
        }
      }

      return {
        // Use exact event-page placement logic for regional rows, matched by participating team labels.
        placement: (() => {
          if (scope !== "regional") return null;
          if (!event || !rowSeason || !split) return null;
          const eventKey = eventPlacementKey(event, rowSeason, split, scope, tier);
          const map = placementLookup.get(eventKey);
          if (!map) return null;
          for (const label of teamLabels) {
            const placement = map.get(normalizeTeamLabel(label));
            if (placement) return placement;
          }
          return null;
        })(),
        eventId: row.event_id ?? null,
        season: row.season ?? null,
        split: row.split ?? null,
        event: row.event ?? null,
        scope,
        tier,
        stageReached: row.stage_reached ?? null,
        seriesPlayed: Number(row.series_played ?? 0),
        seriesWon: Number(row.series_won ?? 0),
        gamesPlayed: Number(row.games_played ?? 0),
        gamesWon: Number(row.games_won ?? 0),
        firstDate: row.first_date ?? null,
        lastDate: row.last_date ?? null,
        rosterId: row.roster_id ?? null,
        rosterStarters: row.roster_starters ?? [],
        opponent,
        playerWins,
        opponentWins,
        wonSeries
      };
    });

    json(res, 200, { season, rows: enrichedRows });
  });
}
