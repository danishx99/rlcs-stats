import { type IncomingMessage, type ServerResponse } from "node:http";
import { pool } from "../db";
import { json } from "../utils/http";
import { buildFilterClauses, normalizeMode } from "../utils/filters";
import { metricExpression, resolveStatOption } from "../utils/stats";
import { formatSql, loadSql } from "../utils/sql";
const rosterSeasonSql = loadSql("../../sql/rosters/season.sql", import.meta.url);
const rosterProfileSql = loadSql("../../sql/rosters/profile.sql", import.meta.url);
const rosterResultsSql = loadSql("../../sql/rosters/results.sql", import.meta.url);
const eventTopTeamsSql = loadSql("../../sql/events/top-teams.sql", import.meta.url);
const rosterFinalSeriesSql = loadSql("../../sql/rosters/final-series.sql", import.meta.url);

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

  try {
    const result = await pool.query(
      formatSql(rosterResultsSql, {
        rosterIdParam: `$${rosterIndex}`,
        where
      }),
      [...values, rosterKey]
    );

    const normalizeTeam = (value: string | null | undefined) => value?.trim().toUpperCase() ?? "";
    const eventPlacementKey = (
      event: string,
      seasonValue: string,
      splitValue: string,
      scopeValue: string | null,
      tierValue: string | null
    ) => `${seasonValue}::${splitValue}::${event}::${scopeValue ?? "<null>"}::${tierValue ?? "<null>"}`;
    const placementsByEvent = new Map<string, string>();

    const regionalRows = result.rows.filter((row) => row.scope === "regional");
    await Promise.all(regionalRows.map(async (row) => {
      const event = typeof row.event === "string" ? row.event : null;
      const rowSeason = typeof row.season === "string" ? row.season : null;
      const split = typeof row.split === "string" ? row.split : null;
      const scope = typeof row.scope === "string" ? row.scope : null;
      const tier = typeof row.tier === "string" ? row.tier : null;
      if (!event || !rowSeason || !split || !scope) return;

      const key = eventPlacementKey(event, rowSeason, split, scope, tier);
      if (!placementsByEvent.has(key)) {
        const teamsResult = await pool.query(eventTopTeamsSql, [event, rowSeason, split, "3s", scope, tier, 256]);
        const map = new Map<string, string>();
        for (const teamRow of teamsResult.rows) {
          const team = normalizeTeam(teamRow.team);
          if (!team) continue;
          const start = Number(teamRow.placement_start ?? 0);
          const end = Number(teamRow.placement_end ?? 0);
          if (!start || !end) continue;
          map.set(team, start === end ? `Top ${start}` : `Top ${start}-${end}`);
        }
        placementsByEvent.set(key, JSON.stringify(Array.from(map.entries())));
      }
    }));

    const placementLookup = new Map<string, Map<string, string>>();
    for (const [key, value] of placementsByEvent.entries()) {
      placementLookup.set(key, new Map(JSON.parse(value) as Array<[string, string]>));
    }

    const enrichedRows = await Promise.all(result.rows.map(async (row) => {
      const event = typeof row.event === "string" ? row.event : null;
      const rowSeason = typeof row.season === "string" ? row.season : null;
      const split = typeof row.split === "string" ? row.split : null;
      const scope = typeof row.scope === "string" ? row.scope : null;
      const tier = typeof row.tier === "string" ? row.tier : null;
      const teamLabels = Array.isArray(row.team_labels)
        ? row.team_labels.filter((value: unknown): value is string => typeof value === "string")
        : [];

      let opponent: string | null = null;
      let playerWins = 0;
      let opponentWins = 0;
      let wonSeries = false;

      if (event && rowSeason && split && teamLabels.length > 0) {
        const finalSeriesResult = await pool.query(
          rosterFinalSeriesSql,
          [event, rowSeason, split, "3s", scope, tier, teamLabels]
        );
        const finalSeries = finalSeriesResult.rows[0];
        if (finalSeries) {
          opponent = finalSeries.opponent ?? null;
          playerWins = Number(finalSeries.own_wins ?? 0);
          opponentWins = Number(finalSeries.opponent_wins ?? 0);
          wonSeries = Boolean(finalSeries.won_series);
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
            const placement = map.get(normalizeTeam(label));
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
    }));

    json(res, 200, { season, rows: enrichedRows });
  } catch (error) {
    console.error(error);
    json(res, 500, { error: "Failed to load roster results" });
  }
}
