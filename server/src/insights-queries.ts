export const INSIGHTS = [
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
