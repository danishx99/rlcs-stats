import { createServer } from "node:http";
import { Readable } from "node:stream";
import { Pool } from "pg";
import "dotenv/config";

const PORT = Number.parseInt(process.env.API_PORT ?? "8787", 10);
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

const STAT_OPTIONS = [
  { key: "goals", label: "Goals", column: "Goals_All Zones", format: "float" },
  { key: "assists", label: "Assists", column: "Assists_All Zones", format: "float" },
  { key: "saves", label: "Saves", column: "Saves_All Zones", format: "float" },
  { key: "demos", label: "Demos", column: "Kills_All Zones", format: "float" },
  { key: "shots", label: "Shots", column: "Shots_All Zones", format: "float" },
  { key: "score", label: "Score", column: "Score_All Zones", format: "float" },
  { key: "avg_speed", label: "Avg Speed", column: "Average Speed_All Zones", format: "float" },
  { key: "on_ground", label: "On Ground %", column: "On Ground_All Zones", format: "pct" },
  { key: "in_air", label: "In Air", column: "In Air_All Zones", format: "float" },
  { key: "series_played", label: "Series Played", kind: "series_played", format: "int" }
];

const DEFAULT_COMPARE_STATS = ["goals", "assists", "saves", "demos"];

const insights = [
  {
    id: "highest-scoring-series",
    title: "Highest Scoring Series",
    subtitle: "Total goals",
    sql: `
      SELECT *
      FROM (
      SELECT
        MIN("Season") AS season,
        MIN("Split") AS split,
        MIN("Regional") AS regional,
        MIN("Stage") AS stage,
        MIN("Best of ") AS best_of,
        MIN("Team") AS team_a,
        MAX("Team") AS team_b,
        ROUND(SUM("Goals_All Zones" * (300 + COALESCE("Extra Time", 0)) / 300.0))::INT AS total_goals
      FROM stats
      GROUP BY regexp_replace(regexp_replace("Match ID", '^[0-9]{8}-[0-9]{6}-', ''), '-G[0-9]+$', '')
      ) series
      ORDER BY total_goals DESC
      LIMIT 10;
    `
  },
  {
    id: "least-grounded-player",
    title: "Least Grounded Player",
    subtitle: "Lowest avg on-ground %",
    sql: `
      SELECT
        MIN("Player Name") AS player_name,
        ARRAY_AGG(DISTINCT "Team") AS teams,
        COUNT(*) AS games,
        AVG("On Ground_All Zones") AS avg_on_ground
      FROM stats
      GROUP BY "Unique ID"
      ORDER BY avg_on_ground ASC, games DESC
      LIMIT 10;
    `
  },
  {
    id: "best-grand-finals",
    title: "Best Player in Grand Finals",
    subtitle: "Highest win rate in GF",
    sql: `
      SELECT
        MIN("Player Name") AS player_name,
        ARRAY_AGG(DISTINCT "Team") AS teams,
        COUNT(*) AS games,
        SUM(CASE WHEN "Victory" THEN 1 ELSE 0 END) AS wins,
        ROUND(
          (AVG(CASE WHEN "Victory" THEN 1.0 ELSE 0.0 END) * 100.0)::NUMERIC,
          2
        ) AS "win_rate (%)"
      FROM stats
      WHERE "Stage" = 'Playoffs'
        AND "Round" ILIKE '%GF%'
      GROUP BY "Unique ID"
      ORDER BY "win_rate (%)" DESC, games DESC
      LIMIT 10;
    `
  },
  {
    id: "best-decider",
    title: "Best Player in Deciding Game",
    subtitle: "Game 5 or 7 win rate",
    sql: `
      SELECT
        MIN("Player Name") AS player_name,
        ARRAY_AGG(DISTINCT "Team") AS teams,
        COUNT(*) AS games,
        SUM(CASE WHEN "Victory" THEN 1 ELSE 0 END) AS wins,
        ROUND(
          (AVG(CASE WHEN "Victory" THEN 1.0 ELSE 0.0 END) * 100.0)::NUMERIC,
          2
        ) AS "win_rate (%)"
      FROM stats
      WHERE "Best of " IN (5, 7)
        AND "Game Number" = "Best of "
      GROUP BY "Unique ID"
      HAVING COUNT(*) >= 5
      ORDER BY "win_rate (%)" DESC, games DESC
      LIMIT 10;
    `
  },
  {
    id: "fastest-player",
    title: "Fastest Player",
    subtitle: "Highest avg speed",
    sql: `
      SELECT
        MIN("Player Name") AS player_name,
        ARRAY_AGG(DISTINCT "Team") AS teams,
        COUNT(*) AS games,
        AVG("Average Speed_All Zones") AS avg_speed
      FROM stats
      GROUP BY "Unique ID"
      ORDER BY avg_speed DESC, games DESC
      LIMIT 10;
    `
  },
  {
    id: "most-successful-team",
    title: "Most Successful Team",
    subtitle: "Roster-based series win rate + total series",
    sql: `
      WITH base AS (
        SELECT
          regexp_replace(regexp_replace("Match ID", '^[0-9]{8}-[0-9]{6}-', ''), '-G[0-9]+$', '') AS series_id,
          "Team" AS team,
          "Game Number" AS game_number,
          "Victory" AS victory,
          "Best of " AS best_of,
          "Unique ID" AS player_id,
          "Player Name" AS player_name
        FROM stats
      ),
      player_counts AS (
        SELECT
          series_id,
          team,
          player_id,
          MIN(player_name) AS player_name,
          COUNT(*) AS appearances
        FROM base
        GROUP BY series_id, team, player_id
      ),
      ranked AS (
        SELECT
          series_id,
          team,
          player_id,
          player_name,
          ROW_NUMBER() OVER (
            PARTITION BY series_id, team
            ORDER BY appearances DESC, player_id
          ) AS rn
        FROM player_counts
      ),
      roster_map AS (
        SELECT
          series_id,
          team,
          ARRAY_AGG(player_id ORDER BY rn) FILTER (WHERE rn <= 3) AS roster_ids,
          ARRAY_AGG(player_name ORDER BY rn) FILTER (WHERE rn <= 3) AS roster
        FROM ranked
        GROUP BY series_id, team
      ),
      game_results AS (
        SELECT
          series_id,
          team,
          game_number,
          MAX(CASE WHEN victory THEN 1 ELSE 0 END) AS won_game
        FROM base
        GROUP BY series_id, team, game_number
      ),
      series_wins AS (
        SELECT
          series_id,
          team,
          SUM(won_game) AS games_won,
          MAX(best_of) AS best_of
        FROM base
        JOIN game_results USING (series_id, team, game_number)
        GROUP BY series_id, team
      ),
      series_winners AS (
        SELECT *
        FROM series_wins
        WHERE games_won >= CEIL(best_of / 2.0)
      ),
      series_played AS (
        SELECT series_id, team
        FROM base
        GROUP BY series_id, team
      )
      SELECT
        roster_map.roster AS roster,
        ARRAY_AGG(DISTINCT roster_map.team) AS team_labels,
        COUNT(series_winners.series_id) AS series_wins,
        COUNT(series_played.series_id) AS series_played,
        ROUND(
          (
            COUNT(series_winners.series_id)::DOUBLE PRECISION
              / NULLIF(COUNT(series_played.series_id), 0) * 100.0
          )::NUMERIC,
          2
        ) AS "win_rate (%)"
      FROM series_played
      JOIN roster_map USING (series_id, team)
      LEFT JOIN series_winners USING (series_id, team)
      WHERE roster_map.roster IS NOT NULL
      GROUP BY roster_map.roster
      HAVING COUNT(series_played.series_id) >= 5
      ORDER BY "win_rate (%)" DESC, series_played DESC
      LIMIT 10;
    `
  },
  {
    id: "best-ot-performer",
    title: "Best OT Performer",
    subtitle: "Highest OT win rate",
    sql: `
      SELECT
        MIN("Player Name") AS player_name,
        ARRAY_AGG(DISTINCT "Team") AS teams,
        COUNT(*) AS ot_games,
        SUM(CASE WHEN "Victory" THEN 1 ELSE 0 END) AS ot_wins,
        ROUND(
          (AVG(CASE WHEN "Victory" THEN 1.0 ELSE 0.0 END) * 100.0)::NUMERIC,
          2
        ) AS "win_rate (%)"
      FROM stats
      WHERE "OT" = true
      GROUP BY "Unique ID"
      HAVING COUNT(*) >= 5
      ORDER BY "win_rate (%)" DESC, ot_games DESC
      LIMIT 10;
    `
  },
  {
    id: "most-demos",
    title: "Most Demos per Game",
    subtitle: "Avg kills",
    sql: `
      SELECT
        MIN("Player Name") AS player_name,
        ARRAY_AGG(DISTINCT "Team") AS teams,
        COUNT(*) AS games,
        AVG("Kills_All Zones") AS avg_kills
      FROM stats
      GROUP BY "Unique ID"
      ORDER BY avg_kills DESC, games DESC
      LIMIT 10;
    `
  },
  {
    id: "best-accuracy",
    title: "Best Shooting Accuracy",
    subtitle: "Time-adjusted shots & goals",
    sql: `
      SELECT
        MIN("Player Name") AS player_name,
        ARRAY_AGG(DISTINCT "Team") AS teams,
        ROUND(SUM("Shots_All Zones" * (300 + COALESCE("Extra Time", 0)) / 300.0))::INT AS shots,
        ROUND(SUM("Goals_All Zones" * (300 + COALESCE("Extra Time", 0)) / 300.0))::INT AS goals,
        SUM("Goals_All Zones" * (300 + COALESCE("Extra Time", 0)) / 300.0)
          / NULLIF(SUM("Shots_All Zones" * (300 + COALESCE("Extra Time", 0)) / 300.0), 0) AS accuracy
      FROM stats
      GROUP BY "Unique ID"
      ORDER BY accuracy DESC, shots DESC
      LIMIT 10;
    `
  },
  {
    id: "top-assist-rate",
    title: "Top Assist Rate",
    subtitle: "Time-adjusted assists per game",
    sql: `
      SELECT
        MIN("Player Name") AS player_name,
        ARRAY_AGG(DISTINCT "Team") AS teams,
        COUNT(*) AS games,
        AVG("Assists_All Zones" * (300 + COALESCE("Extra Time", 0)) / 300.0) AS avg_assists
      FROM stats
      GROUP BY "Unique ID"
      ORDER BY avg_assists DESC, games DESC
      LIMIT 10;
    `
  },
  {
    id: "best-passer",
    title: "Best Passer",
    subtitle: "Avg passes given",
    sql: `
      SELECT
        MIN("Player Name") AS player_name,
        ARRAY_AGG(DISTINCT "Team") AS teams,
        COUNT(*) AS games,
        AVG("Passes Given_All Zones") AS avg_passes_given
      FROM stats
      GROUP BY "Unique ID"
      ORDER BY avg_passes_given DESC, games DESC
      LIMIT 10;
    `
  },
  {
    id: "best-receiver",
    title: "Best Receiver",
    subtitle: "Avg passes received",
    sql: `
      SELECT
        MIN("Player Name") AS player_name,
        ARRAY_AGG(DISTINCT "Team") AS teams,
        COUNT(*) AS games,
        AVG("Passes Received_All Zones") AS avg_passes_received
      FROM stats
      GROUP BY "Unique ID"
      ORDER BY avg_passes_received DESC, games DESC
      LIMIT 10;
    `
  },
  {
    id: "best-security",
    title: "Best Ball Security",
    subtitle: "Lowest possession losses",
    sql: `
      SELECT
        MIN("Player Name") AS player_name,
        ARRAY_AGG(DISTINCT "Team") AS teams,
        COUNT(*) AS games,
        AVG("Possession Losses_All Zones") AS avg_possession_losses
      FROM stats
      GROUP BY "Unique ID"
      ORDER BY avg_possession_losses ASC, games DESC
      LIMIT 10;
    `
  },
  {
    id: "most-interceptions",
    title: "Most Interceptions",
    subtitle: "Avg per game",
    sql: `
      SELECT
        MIN("Player Name") AS player_name,
        ARRAY_AGG(DISTINCT "Team") AS teams,
        COUNT(*) AS games,
        AVG("Interceptions_All Zones") AS avg_interceptions
      FROM stats
      GROUP BY "Unique ID"
      ORDER BY avg_interceptions DESC, games DESC
      LIMIT 10;
    `
  },
  {
    id: "most-aerial",
    title: "Most Aerial Player",
    subtitle: "Avg time in air",
    sql: `
      SELECT
        MIN("Player Name") AS player_name,
        ARRAY_AGG(DISTINCT "Team") AS teams,
        COUNT(*) AS games,
        AVG("In Air_All Zones") AS avg_in_air
      FROM stats
      GROUP BY "Unique ID"
      ORDER BY avg_in_air DESC, games DESC
      LIMIT 10;
    `
  },
  {
    id: "longest-distance",
    title: "Longest Distance Traveled",
    subtitle: "Avg distance",
    sql: `
      SELECT
        MIN("Player Name") AS player_name,
        ARRAY_AGG(DISTINCT "Team") AS teams,
        COUNT(*) AS games,
        AVG("Distance traveled_All Zones") AS avg_distance
      FROM stats
      GROUP BY "Unique ID"
      ORDER BY avg_distance DESC, games DESC
      LIMIT 10;
    `
  },
  {
    id: "best-team-winrate",
    title: "Best Team Win Rate",
    subtitle: "Roster-based game win rate",
    sql: `
      WITH base AS (
        SELECT
          regexp_replace(regexp_replace("Match ID", '^[0-9]{8}-[0-9]{6}-', ''), '-G[0-9]+$', '') AS series_id,
          "Game Number" AS game_number,
          "Team" AS team,
          "Victory" AS victory,
          "Unique ID" AS player_id,
          "Player Name" AS player_name
        FROM stats
      ),
      player_counts AS (
        SELECT
          series_id,
          team,
          player_id,
          MIN(player_name) AS player_name,
          COUNT(*) AS appearances
        FROM base
        GROUP BY series_id, team, player_id
      ),
      ranked AS (
        SELECT
          series_id,
          team,
          player_id,
          player_name,
          ROW_NUMBER() OVER (
            PARTITION BY series_id, team
            ORDER BY appearances DESC, player_id
          ) AS rn
        FROM player_counts
      ),
      roster_map AS (
        SELECT
          series_id,
          team,
          ARRAY_AGG(player_id ORDER BY rn) FILTER (WHERE rn <= 3) AS roster_ids,
          ARRAY_AGG(player_name ORDER BY rn) FILTER (WHERE rn <= 3) AS roster
        FROM ranked
        GROUP BY series_id, team
      ),
      team_game AS (
        SELECT
          base.series_id,
          base.game_number,
          base.team,
          base.victory,
          roster_map.roster
        FROM base
        JOIN roster_map USING (series_id, team)
        GROUP BY base.series_id, base.game_number, base.team, base.victory, roster_map.roster
      )
      SELECT
        roster,
        ARRAY_AGG(DISTINCT team) AS team_labels,
        COUNT(*) AS games,
        SUM(CASE WHEN victory THEN 1 ELSE 0 END) AS wins,
        ROUND(
          (AVG(CASE WHEN victory THEN 1.0 ELSE 0.0 END) * 100.0)::NUMERIC,
          2
        ) AS "win_rate (%)"
      FROM team_game
      WHERE roster IS NOT NULL
      GROUP BY roster
      ORDER BY "win_rate (%)" DESC, games DESC
      LIMIT 10;
    `
  },
  {
    id: "team-goals-per-game",
    title: "Team Goals per Game",
    subtitle: "Roster-based, time-adjusted",
    sql: `
      WITH base AS (
        SELECT
          regexp_replace(regexp_replace("Match ID", '^[0-9]{8}-[0-9]{6}-', ''), '-G[0-9]+$', '') AS series_id,
          "Game Number" AS game_number,
          "Team" AS team,
          "Unique ID" AS player_id,
          "Player Name" AS player_name,
          "Goals_All Zones" AS goals,
          "Extra Time" AS extra_time
        FROM stats
      ),
      player_counts AS (
        SELECT
          series_id,
          team,
          player_id,
          MIN(player_name) AS player_name,
          COUNT(*) AS appearances
        FROM base
        GROUP BY series_id, team, player_id
      ),
      ranked AS (
        SELECT
          series_id,
          team,
          player_id,
          player_name,
          ROW_NUMBER() OVER (
            PARTITION BY series_id, team
            ORDER BY appearances DESC, player_id
          ) AS rn
        FROM player_counts
      ),
      roster_map AS (
        SELECT
          series_id,
          team,
          ARRAY_AGG(player_id ORDER BY rn) FILTER (WHERE rn <= 3) AS roster_ids,
          ARRAY_AGG(player_name ORDER BY rn) FILTER (WHERE rn <= 3) AS roster
        FROM ranked
        GROUP BY series_id, team
      ),
      team_game_goals AS (
        SELECT
          base.series_id,
          base.game_number,
          base.team,
          roster_map.roster,
          ROUND(SUM(base.goals * (300 + COALESCE(base.extra_time, 0)) / 300.0))::INT AS team_goals
        FROM base
        JOIN roster_map USING (series_id, team)
        GROUP BY base.series_id, base.game_number, base.team, roster_map.roster
      )
      SELECT
        roster,
        ARRAY_AGG(DISTINCT team) AS team_labels,
        COUNT(*) AS games,
        AVG(team_goals) AS avg_team_goals
      FROM team_game_goals
      WHERE roster IS NOT NULL
      GROUP BY roster
      ORDER BY avg_team_goals DESC, games DESC
      LIMIT 10;
    `
  },
  {
    id: "best-score",
    title: "Best Player by Score",
    subtitle: "Time-adjusted score per game",
    sql: `
      SELECT
        MIN("Player Name") AS player_name,
        ARRAY_AGG(DISTINCT "Team") AS teams,
        COUNT(*) AS games,
        AVG("Score_All Zones" * (300 + COALESCE("Extra Time", 0)) / 300.0) AS avg_score
      FROM stats
      GROUP BY "Unique ID"
      ORDER BY avg_score DESC, games DESC
      LIMIT 10;
    `
  },
  {
    id: "longest-ot",
    title: "Longest Overtime Game",
    subtitle: "Max OT duration",
    sql: `
      SELECT
        "Match ID" AS match_id,
        "Game Number" AS game_number,
        ARRAY_AGG(DISTINCT "Team") AS teams,
        MAX("Extra Time") AS extra_time_seconds
      FROM stats
      WHERE "OT" = true
      GROUP BY "Match ID", "Game Number"
      ORDER BY extra_time_seconds DESC
      LIMIT 10;
    `
  }
];

function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS"
  });
  res.end(body);
}

function isAllowedImageHost(hostname) {
  const normalized = hostname.toLowerCase();
  return (
    normalized === "liquipedia.net" ||
    normalized.endsWith(".liquipedia.net") ||
    normalized === "liquipedia.org" ||
    normalized.endsWith(".liquipedia.org")
  );
}

function normalizeMode(raw) {
  return raw === "total" ? "total" : "avg";
}

function normalizeFilter(value) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === "all") return null;
  return trimmed;
}

function parseListParam(value) {
  if (!value) return [];
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function buildFilterClauses(params, alias = "s") {
  const clauses = [];
  const values = [];
  const season = normalizeFilter(params.get("season"));
  const split = normalizeFilter(params.get("split"));
  const event = normalizeFilter(params.get("event"));

  if (season) {
    clauses.push(`LOWER(TRIM(${alias}."Season")) = LOWER($${values.length + 1})`);
    values.push(season);
  }
  if (split) {
    clauses.push(`LOWER(TRIM(${alias}."Split")) = LOWER($${values.length + 1})`);
    values.push(split);
  }
  if (event) {
    clauses.push(`LOWER(TRIM(${alias}."Regional")) = LOWER($${values.length + 1})`);
    values.push(event);
  }

  return { clauses, values };
}

function seriesIdExpr(alias) {
  return `regexp_replace(regexp_replace(${alias}."Match ID", '^[0-9]{8}-[0-9]{6}-', ''), '-G[0-9]+$', '')`;
}

function playerKeyExpr(alias) {
  return `NULLIF(TRIM(${alias}."Unique ID"), '')`;
}

function resolveStatOption(key) {
  return STAT_OPTIONS.find((option) => option.key === key) ?? null;
}

function metricExpression(option, mode, alias) {
  if (!option) return "NULL";
  if (option.kind === "series_played") {
    return `COUNT(DISTINCT ${seriesIdExpr(alias)})`;
  }
  if (!option.column) return "NULL";
  const column = `${alias}."${option.column}"`;
  if (mode === "total") {
    return `SUM(${column})`;
  }
  return `AVG(${column})`;
}

const server = createServer(async (req, res) => {
  if (!req.url || !req.headers.host) {
    json(res, 400, { error: "Bad request" });
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS"
    });
    res.end();
    return;
  }

  if (req.method !== "GET") {
    json(res, 405, { error: "Method not allowed" });
    return;
  }

  if (url.pathname === "/api/health") {
    json(res, 200, { ok: true, time: new Date().toISOString() });
    return;
  }

  if (url.pathname === "/api/image") {
    const target = url.searchParams.get("url");
    if (!target) {
      json(res, 400, { error: "Missing url" });
      return;
    }
    try {
      const targetUrl = new URL(target);
      if (!["http:", "https:"].includes(targetUrl.protocol)) {
        json(res, 400, { error: "Invalid protocol" });
        return;
      }
      if (!isAllowedImageHost(targetUrl.hostname)) {
        json(res, 403, { error: "Host not allowed" });
        return;
      }
      const response = await fetch(targetUrl.toString(), {
        headers: {
          "User-Agent": "RLCS-Stats/1.0",
          Referer: "https://liquipedia.net/",
          Accept: "image/avif,image/webp,image/*,*/*;q=0.8"
        },
        redirect: "follow"
      });
      if (!response.ok || !response.body) {
        json(res, 502, { error: "Failed to fetch image" });
        return;
      }
      const contentType = response.headers.get("content-type") ?? "image/jpeg";
      res.writeHead(200, {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800"
      });
      Readable.fromWeb(response.body).pipe(res);
    } catch (error) {
      console.error(error);
      json(res, 500, { error: "Image proxy failed" });
    }
    return;
  }

  if (url.pathname === "/api/meta") {
    try {
      const seasonFilter = normalizeFilter(url.searchParams.get("season"));
      const splitFilter = normalizeFilter(url.searchParams.get("split"));
      const splitParams = seasonFilter ? [seasonFilter] : [];
      const splitWhere = seasonFilter
        ? "AND LOWER(TRIM(\"Season\")) = LOWER($1)"
        : "";
      const eventParams = [];
      let eventWhere = "";
      if (seasonFilter) {
        eventWhere += ` AND LOWER(TRIM("Season")) = LOWER($${eventParams.length + 1})`;
        eventParams.push(seasonFilter);
      }
      if (splitFilter) {
        eventWhere += ` AND LOWER(TRIM("Split")) = LOWER($${eventParams.length + 1})`;
        eventParams.push(splitFilter);
      }

      const [seasons, splits, events] = await Promise.all([
        pool.query(
          `
          SELECT MIN(TRIM("Season")) AS value
          FROM stats
          WHERE "Season" IS NOT NULL AND TRIM("Season") <> ''
          GROUP BY LOWER(TRIM("Season"))
          ORDER BY value;
          `
        ),
        pool.query(
          `
          SELECT MIN(TRIM("Split")) AS value
          FROM stats
          WHERE "Split" IS NOT NULL AND TRIM("Split") <> ''
          ${splitWhere}
          GROUP BY LOWER(TRIM("Split"))
          ORDER BY value;
          `,
          splitParams
        ),
        pool.query(
          `
          SELECT MIN(TRIM("Regional")) AS value
          FROM stats
          WHERE "Regional" IS NOT NULL AND TRIM("Regional") <> ''
          ${eventWhere}
          GROUP BY LOWER(TRIM("Regional"))
          ORDER BY value;
          `,
          eventParams
        )
      ]);

      json(res, 200, {
        generatedAt: new Date().toISOString(),
        seasons: seasons.rows.map((row) => row.value).filter(Boolean),
        splits: splits.rows.map((row) => row.value).filter(Boolean),
        events: events.rows.map((row) => row.value).filter(Boolean),
        statOptions: STAT_OPTIONS.map(({ key, label, format }) => ({
          key,
          label,
          format
        }))
      });
      return;
    } catch (error) {
      console.error(error);
      json(res, 500, { error: "Failed to load metadata" });
      return;
    }
  }

  if (url.pathname === "/api/search") {
    const type = url.searchParams.get("type") ?? "players";
    const query = url.searchParams.get("q") ?? "";
    const limit = Math.min(Number.parseInt(url.searchParams.get("limit") ?? "8", 10), 25);

    if (!query.trim() && type !== "stats") {
      json(res, 200, { results: [] });
      return;
    }

    try {
      if (type === "stats") {
        const term = query.trim().toLowerCase();
        const results = STAT_OPTIONS.filter((option) =>
          term
            ? `${option.label} ${option.key}`.toLowerCase().includes(term)
            : true
        ).map((option) => ({
          id: option.key,
          label: option.label,
          type: "stat"
        }));
        json(res, 200, { results: results.slice(0, limit) });
        return;
      }

      if (type === "teams") {
        const like = `%${query.trim()}%`;
        const result = await pool.query(
          `
          SELECT DISTINCT "Team" AS team
          FROM stats
          WHERE "Team" ILIKE $1
          ORDER BY "Team"
          LIMIT $2;
          `,
          [like, limit]
        );
        json(res, 200, {
          results: result.rows.map((row) => ({
            id: row.team,
            label: row.team,
            type: "team"
          }))
        });
        return;
      }

      const like = `%${query.trim()}%`;
      const result = await pool.query(
        `
        WITH base AS (
          SELECT
            ${playerKeyExpr("s")} AS player_key,
            COALESCE(p."Primary Handle", s."Player Name") AS label,
            p."All Aliases" AS aliases,
            p."Real Name" AS real_name,
            p."Photo URL" AS photo_url,
            p."Country" AS country,
            s."Player Name" AS player_name
          FROM stats s
          LEFT JOIN players p ON p."Player ID" = ${playerKeyExpr("s")}
        )
        SELECT DISTINCT ON (player_key)
          player_key AS id,
          label,
          photo_url,
          country
        FROM base
        WHERE label ILIKE $1
           OR aliases ILIKE $1
           OR real_name ILIKE $1
           OR player_name ILIKE $1
        ORDER BY player_key, label
        LIMIT $2;
        `,
        [like, limit]
      );
      json(res, 200, {
        results: result.rows.map((row) => ({
          id: row.id,
          label: row.label,
          type: "player",
          meta: {
            photoUrl: row.photo_url,
            country: row.country
          }
        }))
      });
      return;
    } catch (error) {
      console.error(error);
      json(res, 500, { error: "Search failed" });
      return;
    }
  }

  if (url.pathname === "/api/players") {
    const { clauses, values } = buildFilterClauses(url.searchParams, "s");
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const limit = Math.min(Number.parseInt(url.searchParams.get("limit") ?? "20", 10), 100);
    const offset = Number.parseInt(url.searchParams.get("offset") ?? "0", 10);
    const limitIndex = values.length + 1;
    const offsetIndex = values.length + 2;

    try {
      const result = await pool.query(
        `
        WITH base AS (
          SELECT
            s.*,
            ${playerKeyExpr("s")} AS player_key
          FROM stats s
          ${where}
        )
        SELECT
          base.player_key AS id,
          COALESCE(MIN(p."Primary Handle"), MIN(base."Player Name")) AS label,
          MIN(p."All Aliases") AS aliases,
          MIN(p."Country") AS country,
          MIN(p."Photo URL") AS photo_url,
          ARRAY_AGG(DISTINCT base."Team") AS teams,
          COUNT(*) AS games
        FROM base
        LEFT JOIN players p ON p."Player ID" = base.player_key
        GROUP BY base.player_key
        ORDER BY games DESC
        LIMIT $${limitIndex}
        OFFSET $${offsetIndex};
        `,
        [...values, limit, offset]
      );

      json(res, 200, {
        players: result.rows.map((row) => ({
          id: row.id,
          label: row.label,
          aliases: row.aliases,
          country: row.country,
          photoUrl: row.photo_url,
          teams: row.teams ?? [],
          games: Number(row.games ?? 0)
        }))
      });
      return;
    } catch (error) {
      console.error(error);
      json(res, 500, { error: "Failed to load players" });
      return;
    }
  }

  if (url.pathname.startsWith("/api/players/")) {
    const parts = url.pathname.split("/").filter(Boolean);
    const playerId = parts[2];
    if (!playerId) {
      json(res, 400, { error: "Player id is required" });
      return;
    }

    if (parts[3] === "season") {
      const { clauses, values } = buildFilterClauses(url.searchParams, "s");
      const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
      const mode = normalizeMode(url.searchParams.get("mode"));
      const playerIndex = values.length + 1;

      const goals = metricExpression(resolveStatOption("goals"), mode, "player_scope");
      const assists = metricExpression(resolveStatOption("assists"), mode, "player_scope");
      const saves = metricExpression(resolveStatOption("saves"), mode, "player_scope");
      const demos = metricExpression(resolveStatOption("demos"), mode, "player_scope");

      try {
        const result = await pool.query(
          `
          WITH base AS (
            SELECT
              s.*,
              ${playerKeyExpr("s")} AS player_key,
              ${seriesIdExpr("s")} AS series_id
            FROM stats s
            ${where}
          ),
          player_scope AS (
            SELECT *
            FROM base
            WHERE player_key = $${playerIndex}
          )
          SELECT
            player_scope."Season" AS season,
            COUNT(*) AS games,
            COUNT(DISTINCT player_scope.series_id) AS series_played,
            ${goals} AS goals,
            ${assists} AS assists,
            ${saves} AS saves,
            ${demos} AS demos
          FROM player_scope
          GROUP BY player_scope."Season"
          ORDER BY player_scope."Season";
          `,
          [...values, playerId]
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
        return;
      } catch (error) {
        console.error(error);
        json(res, 500, { error: "Failed to load season performance" });
        return;
      }
    }

    const { clauses, values } = buildFilterClauses(url.searchParams, "s");
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const playerIndex = values.length + 1;

    try {
      const result = await pool.query(
        `
        WITH base AS (
          SELECT
            s.*,
            ${playerKeyExpr("s")} AS player_key,
            ${seriesIdExpr("s")} AS series_id
          FROM stats s
          ${where}
        ),
        player_scope AS (
          SELECT *
          FROM base
          WHERE player_key = $${playerIndex}
        ),
        series_summary AS (
          SELECT
            series_id,
            "Season" AS season,
            "Split" AS split,
            "Regional" AS regional,
            "Stage" AS stage,
            MIN("Round") AS round,
            "Team" AS team,
            MAX("Best of ") AS best_of,
            SUM(CASE WHEN "Victory" THEN 1 ELSE 0 END) AS wins
          FROM player_scope
          GROUP BY series_id, "Season", "Split", "Regional", "Stage", "Team"
        ),
        series_winners AS (
          SELECT
            *,
            wins >= CEIL(best_of / 2.0) AS won_series
          FROM series_summary
        ),
        event_gf AS (
          SELECT
            season,
            split,
            regional,
            stage,
            MAX(
              CASE
                WHEN round ILIKE '%GF 2%' OR round ILIKE '%GF2%' THEN 2
                WHEN round ILIKE '%GF 1%' OR round ILIKE '%GF1%' THEN 1
                WHEN round ILIKE '%GF%' THEN 1
                ELSE 0
              END
            ) AS gf_tier
          FROM series_summary
          GROUP BY season, split, regional, stage
        ),
        gf_champs AS (
          SELECT s.*
          FROM series_winners s
          JOIN event_gf e
            ON s.season IS NOT DISTINCT FROM e.season
           AND s.split IS NOT DISTINCT FROM e.split
           AND s.regional IS NOT DISTINCT FROM e.regional
           AND s.stage IS NOT DISTINCT FROM e.stage
          WHERE s.won_series = true
            AND (
              (e.gf_tier = 2 AND (s.round ILIKE '%GF 2%' OR s.round ILIKE '%GF2%'))
              OR (e.gf_tier <= 1 AND s.round ILIKE '%GF%')
            )
        ),
        best_result AS (
          SELECT
            CASE
              WHEN EXISTS (SELECT 1 FROM gf_champs) THEN 'Top 1'
              WHEN EXISTS (SELECT 1 FROM series_summary WHERE round ILIKE '%GF%') THEN 'Top 2'
              WHEN EXISTS (SELECT 1 FROM series_summary WHERE round ILIKE '%SF%') THEN 'Top 4'
              WHEN EXISTS (SELECT 1 FROM series_summary WHERE round ILIKE '%QF%') THEN 'Top 8'
              WHEN EXISTS (
                SELECT 1 FROM series_summary WHERE round ILIKE '%R16%' OR round ILIKE '%16%'
              ) THEN 'Top 16'
              WHEN EXISTS (
                SELECT 1 FROM series_summary WHERE round ILIKE '%R32%' OR round ILIKE '%32%'
              ) THEN 'Top 32'
              WHEN EXISTS (SELECT 1 FROM series_summary WHERE stage ILIKE '%Playoff%') THEN 'Top 8'
              WHEN EXISTS (SELECT 1 FROM series_summary WHERE stage ILIKE '%Swiss%') THEN 'Top 16'
              ELSE NULL
            END AS placement
        )
        SELECT
          $${playerIndex} AS player_id,
          COALESCE(MIN(p."Primary Handle"), MIN(player_scope."Player Name")) AS handle,
          MIN(player_scope."Player Name") AS player_name,
          MIN(NULLIF(TRIM(p."All Aliases"), '')) AS aliases,
          MIN(NULLIF(TRIM(p."Real Name"), '')) AS real_name,
          MIN(NULLIF(TRIM(p."Country"), '')) AS country,
          MIN(NULLIF(TRIM(p."Photo URL"), '')) AS photo_url,
          MIN(p."Date of Birth") AS date_of_birth,
          MIN(NULLIF(TRIM(p."Twitch"), '')) AS twitch,
          MIN(NULLIF(TRIM(p."TikTok"), '')) AS tiktok,
          ARRAY_AGG(DISTINCT player_scope."Team") AS teams,
          MIN(player_scope."Date") AS debut_date,
          (SELECT placement FROM best_result) AS best_result,
          COUNT(*) AS games,
          COUNT(DISTINCT player_scope.series_id) AS series_played,
          SUM(player_scope."Goals_All Zones") AS goals_total,
          AVG(player_scope."Goals_All Zones") AS goals_avg,
          SUM(player_scope."Assists_All Zones") AS assists_total,
          AVG(player_scope."Assists_All Zones") AS assists_avg,
          SUM(player_scope."Saves_All Zones") AS saves_total,
          AVG(player_scope."Saves_All Zones") AS saves_avg,
          SUM(player_scope."Kills_All Zones") AS demos_total,
          AVG(player_scope."Kills_All Zones") AS demos_avg
        FROM player_scope
        LEFT JOIN players p ON p."Player ID" = player_scope.player_key;
        `,
        [...values, playerId]
      );

      if (!result.rows.length) {
        json(res, 404, { error: "Player not found" });
        return;
      }

      const row = result.rows[0];

      json(res, 200, {
        player: {
          id: row.player_id,
          handle: row.handle,
          playerName: row.player_name,
          aliases: row.aliases,
          realName: row.real_name,
          country: row.country,
          photoUrl: row.photo_url,
          dateOfBirth: row.date_of_birth,
          debutDate: row.debut_date,
          bestResult: row.best_result,
          twitch: row.twitch,
          tiktok: row.tiktok,
          teams: row.teams ?? [],
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
      return;
    } catch (error) {
      console.error(error);
      json(res, 500, { error: "Failed to load player profile" });
      return;
    }
  }

  if (url.pathname === "/api/compare") {
    const type = url.searchParams.get("type") ?? "players";
    const ids = parseListParam(url.searchParams.get("ids"));
    const metricsRaw = parseListParam(url.searchParams.get("metrics"));
    const mode = normalizeMode(url.searchParams.get("mode"));

    if (!ids.length) {
      json(res, 400, { error: "ids is required" });
      return;
    }

    const metrics = metricsRaw.length ? metricsRaw : DEFAULT_COMPARE_STATS;
    const options = metrics
      .map((key) => resolveStatOption(key))
      .filter(Boolean);

    if (!options.length) {
      json(res, 400, { error: "No valid metrics" });
      return;
    }

    if (type === "teams") {
      const { clauses, values } = buildFilterClauses(url.searchParams, "s");
      const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
      const idsIndex = values.length + 1;
      const metricSelect = options
        .map((option) => `${metricExpression(option, mode, "base")} AS "${option.key}"`)
        .join(",\n            ");

      try {
        const result = await pool.query(
          `
          WITH base AS (
            SELECT
              s.*,
              ${seriesIdExpr("s")} AS series_id
            FROM stats s
            ${where}
          )
          SELECT
            base."Team" AS id,
            base."Team" AS label,
            COUNT(*) AS games,
            ${metricSelect}
          FROM base
          WHERE base."Team" = ANY($${idsIndex})
          GROUP BY base."Team"
          ORDER BY base."Team";
          `,
          [...values, ids]
        );

        json(res, 200, {
          mode,
          metrics: options.map((option) => ({ key: option.key, label: option.label })),
          rows: result.rows.map((row) => ({
            id: row.id,
            label: row.label,
            games: Number(row.games ?? 0),
            values: options.reduce((acc, option) => {
              acc[option.key] = Number(row[option.key] ?? 0);
              return acc;
            }, {})
          }))
        });
        return;
      } catch (error) {
        console.error(error);
        json(res, 500, { error: "Failed to compare teams" });
        return;
      }
    }

    const { clauses, values } = buildFilterClauses(url.searchParams, "s");
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const idsIndex = values.length + 1;
    const metricSelect = options
      .map((option) => `${metricExpression(option, mode, "player_scope")} AS "${option.key}"`)
      .join(",\n            ");

    try {
      const result = await pool.query(
        `
        WITH base AS (
          SELECT
            s.*,
            ${playerKeyExpr("s")} AS player_key,
            ${seriesIdExpr("s")} AS series_id
          FROM stats s
          ${where}
        ),
        player_scope AS (
          SELECT *
          FROM base
          WHERE player_key = ANY($${idsIndex})
        )
        SELECT
          player_scope.player_key AS id,
          COALESCE(MIN(p."Primary Handle"), MIN(player_scope."Player Name")) AS label,
          ARRAY_AGG(DISTINCT player_scope."Team") AS teams,
          COUNT(*) AS games,
          ${metricSelect}
        FROM player_scope
        LEFT JOIN players p ON p."Player ID" = player_scope.player_key
        GROUP BY player_scope.player_key
        ORDER BY label;
        `,
        [...values, ids]
      );

      json(res, 200, {
        mode,
        metrics: options.map((option) => ({ key: option.key, label: option.label })),
        rows: result.rows.map((row) => ({
          id: row.id,
          label: row.label,
          teams: row.teams ?? [],
          games: Number(row.games ?? 0),
          values: options.reduce((acc, option) => {
            acc[option.key] = Number(row[option.key] ?? 0);
            return acc;
          }, {})
        }))
      });
      return;
    } catch (error) {
      console.error(error);
      json(res, 500, { error: "Failed to compare players" });
      return;
    }
  }

  if (url.pathname === "/api/stats/top") {
    const metricKey = url.searchParams.get("metric") ?? "score";
    const mode = normalizeMode(url.searchParams.get("mode"));
    const limit = Math.min(Number.parseInt(url.searchParams.get("limit") ?? "10", 10), 50);
    const option = resolveStatOption(metricKey);

    if (!option) {
      json(res, 400, { error: "Invalid metric" });
      return;
    }

    const { clauses, values } = buildFilterClauses(url.searchParams, "s");
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const limitIndex = values.length + 1;
    const valueExpr = metricExpression(option, mode, "player_scope");

    try {
      const result = await pool.query(
        `
        WITH base AS (
          SELECT
            s.*,
            ${playerKeyExpr("s")} AS player_key
          FROM stats s
          ${where}
        ),
        player_scope AS (
          SELECT *
          FROM base
        )
        SELECT
          player_scope.player_key AS id,
          COALESCE(MIN(p."Primary Handle"), MIN(player_scope."Player Name")) AS label,
          ARRAY_AGG(DISTINCT player_scope."Team") AS teams,
          MIN(p."Photo URL") AS photo_url,
          MIN(p."Country") AS country,
          ${valueExpr} AS value
        FROM player_scope
        LEFT JOIN players p ON p."Player ID" = player_scope.player_key
        GROUP BY player_scope.player_key
        ORDER BY value DESC NULLS LAST
        LIMIT $${limitIndex};
        `,
        [...values, limit]
      );

      json(res, 200, {
        generatedAt: new Date().toISOString(),
        mode,
        metric: { key: option.key, label: option.label, format: option.format },
        rows: result.rows.map((row) => ({
          id: row.id,
          label: row.label,
          teams: row.teams ?? [],
          photoUrl: row.photo_url,
          country: row.country,
          value: Number(row.value ?? 0)
        }))
      });
      return;
    } catch (error) {
      console.error(error);
      json(res, 500, { error: "Failed to load leaderboard" });
      return;
    }
  }

  if (url.pathname === "/api/featured") {
    const metricKey = url.searchParams.get("metric") ?? "score";
    const mode = normalizeMode(url.searchParams.get("mode"));
    const limit = Math.min(Number.parseInt(url.searchParams.get("limit") ?? "6", 10), 20);
    const option = resolveStatOption(metricKey);

    if (!option) {
      json(res, 400, { error: "Invalid metric" });
      return;
    }

    const { clauses, values } = buildFilterClauses(url.searchParams, "s");
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const limitIndex = values.length + 1;
    const valueExpr = metricExpression(option, mode, "player_scope");

    try {
      const result = await pool.query(
        `
        WITH base AS (
          SELECT
            s.*,
            ${playerKeyExpr("s")} AS player_key
          FROM stats s
          ${where}
        ),
        player_scope AS (
          SELECT *
          FROM base
        )
        SELECT
          player_scope.player_key AS id,
          COALESCE(MIN(p."Primary Handle"), MIN(player_scope."Player Name")) AS label,
          ARRAY_AGG(DISTINCT player_scope."Team") AS teams,
          MIN(p."Photo URL") AS photo_url,
          MIN(p."Country") AS country,
          ${valueExpr} AS value
        FROM player_scope
        LEFT JOIN players p ON p."Player ID" = player_scope.player_key
        GROUP BY player_scope.player_key
        ORDER BY value DESC NULLS LAST
        LIMIT $${limitIndex};
        `,
        [...values, limit]
      );

      json(res, 200, {
        generatedAt: new Date().toISOString(),
        mode,
        metric: { key: option.key, label: option.label, format: option.format },
        rows: result.rows.map((row) => ({
          id: row.id,
          label: row.label,
          teams: row.teams ?? [],
          photoUrl: row.photo_url,
          country: row.country,
          value: Number(row.value ?? 0)
        }))
      });
      return;
    } catch (error) {
      console.error(error);
      json(res, 500, { error: "Failed to load featured players" });
      return;
    }
  }

  if (url.pathname === "/api/insights") {
    try {
      const results = [];
      for (const insight of insights) {
        const queryResult = await pool.query(insight.sql);
        results.push({
          id: insight.id,
          title: insight.title,
          subtitle: insight.subtitle,
          columns: queryResult.fields.map((field) => field.name),
          rows: queryResult.rows
        });
      }
      json(res, 200, { generatedAt: new Date().toISOString(), insights: results });
      return;
    } catch (error) {
      console.error(error);
      json(res, 500, { error: "Failed to query insights" });
      return;
    }
  }

  json(res, 404, { error: "Not found" });
});

server.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
});
