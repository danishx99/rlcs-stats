import { type IncomingMessage, type ServerResponse } from "node:http";
import { pool } from "../db";
import { json } from "../utils/http";
import { buildFilterClauses } from "../utils/filters";

type QueryRow = {
  id: string;
  label: string;
  entityType: "player" | "match";
  team: string | null;
  value: number;
  valueDisplay: string;
  context: string | null;
  photoUrl: string | null;
  eventId: string | null;
  teamA: string | null;
  teamB: string | null;
};

type QueryCategory = {
  key: string;
  title: string;
  subtitle: string;
  valueLabel: string;
  rows: QueryRow[];
};

const INSIGHTS_CACHE_TTL_MS = 60_000;
const insightsCache = new Map<string, { expiresAt: number; payload: { generatedAt: string; categories: QueryCategory[] } }>();

function formatInt(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? Math.round(n).toLocaleString() : "0";
}

function formatSeconds(value: unknown) {
  const total = Math.max(0, Math.round(Number(value ?? 0)));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim().length ? value : null;
}

function joinParts(parts: Array<string | null>, separator: string) {
  const filtered = parts.filter((part): part is string => Boolean(part));
  return filtered.length ? filtered.join(separator) : null;
}

function eventContext(row: Record<string, unknown>) {
  return joinParts([
    asString(row.season),
    asString(row.split),
    asString(row.event)
  ], " / ");
}

function matchupContext(row: Record<string, unknown>) {
  const teamA = asString(row.team_a);
  const teamB = asString(row.team_b);
  if (teamA && teamB) return `${teamA} vs ${teamB}`;
  return teamA ?? teamB;
}

function contextLabel(key: string, row: Record<string, unknown>) {
  if (key === "most_demos_in_season") {
    return asString(row.season);
  }

  if (key === "most_rlcs_games_played") {
    const firstEvent = joinParts([
      asString(row.first_season),
      asString(row.first_split),
      asString(row.first_event)
    ], " / ");
    return firstEvent ? `First event: ${firstEvent}` : null;
  }

  if (
    key === "highest_in_game_score"
    || key === "most_goals_in_series"
    || key === "most_goals_single_game"
    || key === "longest_overtimes"
  ) {
    return joinParts([eventContext(row), matchupContext(row)], " • ");
  }

  return eventContext(row);
}

function withExtraFilter(where: string, extra: string) {
  if (!extra.trim()) return where;
  if (!where) return `WHERE ${extra}`;
  return `${where} AND ${extra}`;
}

function buildInsightsCacheKey(url: URL, limit: number) {
  const keys = ["season", "split", "event", "gameMode", "scope", "tier"] as const;
  const parts = [`limit=${limit}`];
  for (const key of keys) {
    const value = url.searchParams.get(key);
    if (value && value.trim()) {
      parts.push(`${key}=${value.trim().toLowerCase()}`);
    }
  }
  return parts.join("&");
}

export async function handleInsights(_req: IncomingMessage, res: ServerResponse, url: URL) {
  const rawLimit = Number.parseInt(url.searchParams.get("limit") ?? "", 10);
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 10) : 6;
  const cacheKey = buildInsightsCacheKey(url, limit);
  const cached = insightsCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    json(res, 200, cached.payload);
    return;
  }

  const { clauses, values } = buildFilterClauses(url.searchParams, "s");
  const baseWhere = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

  const queryDefinitions = [
    {
      key: "highest_in_game_score",
      title: "Highest in-game score",
      subtitle: "Top player scores in a single game",
      valueLabel: "Score",
      valueDisplay: formatInt,
      sql: (limitParam: string) => `
        SELECT
          s."Unique ID" AS id,
          COALESCE(p."Primary Handle", s."Player Name") AS label,
          s."Team" AS team,
          s."Score_All Zones"::INT AS value,
          s."Season" AS season,
          s."Split" AS split,
          s."Event" AS event,
          MIN(s."Team") OVER (PARTITION BY s."Match ID", s."Game Number") AS team_a,
          MAX(s."Team") OVER (PARTITION BY s."Match ID", s."Game Number") AS team_b,
          p."Photo URL" AS photo_url,
          md5(
            LOWER(TRIM(COALESCE(s."Season", ''))) || '|' ||
            LOWER(TRIM(COALESCE(s."Split", ''))) || '|' ||
            LOWER(TRIM(COALESCE(s."Event", ''))) || '|' ||
            LOWER(TRIM(COALESCE(s."mode", ''))) || '|' ||
            LOWER(TRIM(COALESCE(s."scope", ''))) || '|' ||
            LOWER(TRIM(COALESCE(s."tier", '')))
          ) AS event_id
        FROM stats s
        LEFT JOIN players p ON p."Unique ID" = s."Unique ID"
        ${baseWhere}
        ORDER BY s."Score_All Zones" DESC NULLS LAST
        LIMIT ${limitParam};
      `
    },
    {
      key: "most_goals_in_series",
      title: "Most goals in a series",
      subtitle: "Highest player total within one series",
      valueLabel: "Goals",
      valueDisplay: formatInt,
      sql: (limitParam: string) => `
        WITH series_rows AS (
          SELECT
            s.*,
            MIN(s."Team") OVER (PARTITION BY s.series_id) AS team_a,
            MAX(s."Team") OVER (PARTITION BY s.series_id) AS team_b
          FROM stats s
          ${withExtraFilter(baseWhere, "s.series_id IS NOT NULL")}
        )
        SELECT
          sr."Unique ID" AS id,
          COALESCE(MIN(p."Primary Handle"), MIN(sr."Player Name")) AS label,
          MIN(sr."Team") AS team,
          SUM(COALESCE(sr."Goals_All Zones", 0))::INT AS value,
          MIN(sr."Season") AS season,
          MIN(sr."Split") AS split,
          MIN(sr."Event") AS event,
          MIN(sr.team_a) AS team_a,
          MIN(sr.team_b) AS team_b,
          MIN(p."Photo URL") AS photo_url,
          md5(
            LOWER(TRIM(COALESCE(MIN(sr."Season"), ''))) || '|' ||
            LOWER(TRIM(COALESCE(MIN(sr."Split"), ''))) || '|' ||
            LOWER(TRIM(COALESCE(MIN(sr."Event"), ''))) || '|' ||
            LOWER(TRIM(COALESCE(MIN(sr."mode"), ''))) || '|' ||
            LOWER(TRIM(COALESCE(MIN(sr."scope"), ''))) || '|' ||
            LOWER(TRIM(COALESCE(MIN(sr."tier"), '')))
          ) AS event_id
        FROM series_rows sr
        LEFT JOIN players p ON p."Unique ID" = sr."Unique ID"
        GROUP BY sr.series_id, sr."Unique ID"
        HAVING SUM(COALESCE(sr."Goals_All Zones", 0)) > 0
        ORDER BY value DESC, label
        LIMIT ${limitParam};
      `
    },
    {
      key: "most_demos_in_season",
      title: "Most demos in a season",
      subtitle: "Highest demolition totals by player-season",
      valueLabel: "Demos",
      valueDisplay: formatInt,
      sql: (limitParam: string) => `
        SELECT
          s."Unique ID" AS id,
          COALESCE(MIN(p."Primary Handle"), MIN(s."Player Name")) AS label,
          MIN(s."Team") AS team,
          SUM(COALESCE(s."Kills_All Zones", 0))::INT AS value,
          s."Season" AS season,
          MIN(s."Split") AS split,
          MIN(s."Event") AS event,
          MIN(p."Photo URL") AS photo_url
        FROM stats s
        LEFT JOIN players p ON p."Unique ID" = s."Unique ID"
        ${baseWhere}
        GROUP BY s."Season", s."Unique ID"
        HAVING SUM(COALESCE(s."Kills_All Zones", 0)) > 0
        ORDER BY value DESC, label
        LIMIT ${limitParam};
      `
    },
    {
      key: "longest_overtimes",
      title: "Longest overtimes",
      subtitle: "Longest OT durations by game",
      valueLabel: "OT",
      valueDisplay: formatSeconds,
      sql: (limitParam: string) => `
        WITH game_rows AS (
          SELECT
            s."Match ID" AS match_id,
            s."Game Number" AS game_number,
            MIN(s."Season") AS season,
            MIN(s."Split") AS split,
            MIN(s."Event") AS event,
            MAX(s."Extra Time") AS value,
            ARRAY_AGG(DISTINCT s."Team" ORDER BY s."Team") AS teams,
            md5(
              LOWER(TRIM(COALESCE(MIN(s."Season"), ''))) || '|' ||
              LOWER(TRIM(COALESCE(MIN(s."Split"), ''))) || '|' ||
              LOWER(TRIM(COALESCE(MIN(s."Event"), ''))) || '|' ||
              LOWER(TRIM(COALESCE(MIN(s."mode"), ''))) || '|' ||
              LOWER(TRIM(COALESCE(MIN(s."scope"), ''))) || '|' ||
              LOWER(TRIM(COALESCE(MIN(s."tier"), '')))
            ) AS event_id
          FROM stats s
          ${withExtraFilter(baseWhere, "s.\"OT\" = true")}
          GROUP BY s."Match ID", s."Game Number"
        )
        SELECT
          match_id AS id,
          CONCAT(COALESCE(teams[1], '—'), ' vs ', COALESCE(teams[2], '—')) AS label,
          NULL::text AS team,
          value::INT AS value,
          season,
          split,
          event,
          COALESCE(teams[1], '—') AS team_a,
          COALESCE(teams[2], '—') AS team_b,
          NULL::text AS photo_url,
          event_id
        FROM game_rows
        ORDER BY value DESC NULLS LAST
        LIMIT ${limitParam};
      `
    },
    {
      key: "most_rlcs_games_played",
      title: "Most RLCS games played",
      subtitle: "Highest total games by player",
      valueLabel: "Games",
      valueDisplay: formatInt,
      sql: (limitParam: string) => `
        SELECT
          s."Unique ID" AS id,
          COALESCE(MIN(p."Primary Handle"), MIN(s."Player Name")) AS label,
          MIN(s."Team") AS team,
          COUNT(*)::INT AS value,
          (ARRAY_AGG(s."Season" ORDER BY s."Date" ASC NULLS LAST, s."Season", s."Split", s."Event"))[1] AS first_season,
          (ARRAY_AGG(s."Split" ORDER BY s."Date" ASC NULLS LAST, s."Season", s."Split", s."Event"))[1] AS first_split,
          (ARRAY_AGG(s."Event" ORDER BY s."Date" ASC NULLS LAST, s."Season", s."Split", s."Event"))[1] AS first_event,
          MIN(p."Photo URL") AS photo_url
        FROM stats s
        LEFT JOIN players p ON p."Unique ID" = s."Unique ID"
        ${baseWhere}
        GROUP BY s."Unique ID"
        ORDER BY value DESC, label
        LIMIT ${limitParam};
      `
    },
    {
      key: "most_goals_single_game",
      title: "Most goals in a single game",
      subtitle: "Highest player goal output in one game",
      valueLabel: "Goals",
      valueDisplay: formatInt,
      sql: (limitParam: string) => `
        SELECT
          s."Unique ID" AS id,
          COALESCE(p."Primary Handle", s."Player Name") AS label,
          s."Team" AS team,
          s."Goals_All Zones"::INT AS value,
          s."Season" AS season,
          s."Split" AS split,
          s."Event" AS event,
          MIN(s."Team") OVER (PARTITION BY s."Match ID", s."Game Number") AS team_a,
          MAX(s."Team") OVER (PARTITION BY s."Match ID", s."Game Number") AS team_b,
          p."Photo URL" AS photo_url,
          md5(
            LOWER(TRIM(COALESCE(s."Season", ''))) || '|' ||
            LOWER(TRIM(COALESCE(s."Split", ''))) || '|' ||
            LOWER(TRIM(COALESCE(s."Event", ''))) || '|' ||
            LOWER(TRIM(COALESCE(s."mode", ''))) || '|' ||
            LOWER(TRIM(COALESCE(s."scope", ''))) || '|' ||
            LOWER(TRIM(COALESCE(s."tier", '')))
          ) AS event_id
        FROM stats s
        LEFT JOIN players p ON p."Unique ID" = s."Unique ID"
        ${baseWhere}
        ORDER BY s."Goals_All Zones" DESC NULLS LAST
        LIMIT ${limitParam};
      `
    }
  ] as const;

  try {
    const limitParam = `$${values.length + 1}`;
    const queryParams = [...values, limit];
    const queryResults = await Promise.all(
      queryDefinitions.map((definition) => pool.query(definition.sql(limitParam), queryParams))
    );

    const categories: QueryCategory[] = queryDefinitions.map((definition, index) => {
      const queryResult = queryResults[index];
      const rows: QueryRow[] = queryResult.rows.map((row: Record<string, unknown>) => ({
        id: String(row.id ?? ""),
        label: String(row.label ?? "—"),
        entityType: definition.key === "longest_overtimes" ? "match" : "player",
        team: typeof row.team === "string" ? row.team : null,
        value: Number(row.value ?? 0),
        valueDisplay: definition.valueDisplay(row.value),
        context: contextLabel(definition.key, row),
        photoUrl: typeof row.photo_url === "string" ? row.photo_url : null,
        eventId: typeof row.event_id === "string" ? row.event_id : null,
        teamA: typeof row.team_a === "string" ? row.team_a : null,
        teamB: typeof row.team_b === "string" ? row.team_b : null
      }));
      return {
        key: definition.key,
        title: definition.title,
        subtitle: definition.subtitle,
        valueLabel: definition.valueLabel,
        rows
      };
    });

    const payload = { generatedAt: new Date().toISOString(), categories };
    insightsCache.set(cacheKey, {
      expiresAt: Date.now() + INSIGHTS_CACHE_TTL_MS,
      payload
    });
    json(res, 200, payload);
  } catch (error) {
    console.error(error);
    json(res, 500, { error: "Failed to query insights" });
  }
}
