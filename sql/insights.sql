-- Normalized per-300s stats are scaled to full game length using:
--   raw_value = normalized_value * (300 + COALESCE("Extra Time", 0)) / 300.0
-- Use series_id to group full series (Match ID includes game suffix like -G1).

-- 1) Highest scoring series (total goals, time-adjusted)
SELECT *
FROM (
  SELECT
    MIN("Season") AS season,
    MIN("Split") AS split,
    MIN("Regional") AS regional,
    MIN("Stage") AS stage,
    MIN("Round") AS round,
    MIN("Day") AS day,
    MIN("Best of ") AS best_of,
    MIN("Team") AS team_a,
    MAX("Team") AS team_b,
    ROUND(SUM("Goals_All Zones" * (300 + COALESCE("Extra Time", 0)) / 300.0))::INT AS total_goals,
  FROM stats
  GROUP BY regexp_replace("Match ID", '-G\\d+$', '')
) series
ORDER BY total_goals DESC
LIMIT 10;

-- 2) Least grounded player (lowest avg on-ground %)
SELECT
  MIN("Player Name") AS player_name,
  ARRAY_AGG(DISTINCT "Team") AS teams,
  COUNT(*) AS games,
  AVG("On Ground_All Zones") AS avg_on_ground
FROM stats
GROUP BY "Unique ID"
ORDER BY avg_on_ground ASC, games DESC
LIMIT 10;

-- 3) Best player in grand finals (highest win rate)
SELECT
  MIN("Player Name") AS player_name,
  ARRAY_AGG(DISTINCT "Team") AS teams,
  COUNT(*) AS games,
  SUM(CASE WHEN "Victory" THEN 1 ELSE 0 END) AS wins,
  AVG(CASE WHEN "Victory" THEN 1.0 ELSE 0.0 END) AS win_rate
FROM stats
WHERE "Stage" = 'Playoff'
  AND "Match ID" LIKE '%Playoff-GF%'
GROUP BY "Unique ID"
ORDER BY win_rate DESC, games DESC
LIMIT 10;

-- 4) Best player in deciding game (Game 5 or 7)
SELECT
  MIN("Player Name") AS player_name,
  ARRAY_AGG(DISTINCT "Team") AS teams,
  COUNT(*) AS games,
  SUM(CASE WHEN "Victory" THEN 1 ELSE 0 END) AS wins,
  AVG(CASE WHEN "Victory" THEN 1.0 ELSE 0.0 END) AS win_rate
FROM stats
WHERE "Best of " IN (5, 7)
  AND "Game Number" = "Best of "
GROUP BY "Unique ID"
ORDER BY win_rate DESC, games DESC
LIMIT 10;

-- 5) Fastest player (highest avg speed)
SELECT
  MIN("Player Name") AS player_name,
  ARRAY_AGG(DISTINCT "Team") AS teams,
  COUNT(*) AS games,
  AVG("Average Speed_All Zones") AS avg_speed
FROM stats
GROUP BY "Unique ID"
ORDER BY avg_speed DESC, games DESC
LIMIT 10;

-- 6) Most successful team (roster-based series win rate, subs allowed)
WITH base AS (
  SELECT
    regexp_replace("Match ID", '-G\\d+$', '') AS series_id,
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
  COUNT(series_winners.series_id)::DOUBLE PRECISION
    / NULLIF(COUNT(series_played.series_id), 0) AS win_rate
FROM series_played
JOIN roster_map USING (series_id, team)
LEFT JOIN series_winners USING (series_id, team)
WHERE roster_map.roster IS NOT NULL
GROUP BY roster_map.roster
ORDER BY win_rate DESC, series_played DESC
LIMIT 10;

-- 7) Best OT performer (highest OT win rate)
SELECT
  MIN("Player Name") AS player_name,
  ARRAY_AGG(DISTINCT "Team") AS teams,
  COUNT(*) AS ot_games,
  SUM(CASE WHEN "Victory" THEN 1 ELSE 0 END) AS ot_wins,
  AVG(CASE WHEN "Victory" THEN 1.0 ELSE 0.0 END) AS win_rate
FROM stats
WHERE "OT" = true
GROUP BY "Unique ID"
ORDER BY win_rate DESC, ot_games DESC
LIMIT 10;

-- 8) Most demos per game
SELECT
  MIN("Player Name") AS player_name,
  ARRAY_AGG(DISTINCT "Team") AS teams,
  COUNT(*) AS games,
  AVG("Kills_All Zones") AS avg_kills
FROM stats
GROUP BY "Unique ID"
ORDER BY avg_kills DESC, games DESC
LIMIT 10;

-- 9) Best shooting accuracy (time-adjusted counts)
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

-- 10) Top assist rate (time-adjusted)
SELECT
  MIN("Player Name") AS player_name,
  ARRAY_AGG(DISTINCT "Team") AS teams,
  COUNT(*) AS games,
  AVG("Assists_All Zones" * (300 + COALESCE("Extra Time", 0)) / 300.0) AS avg_assists
FROM stats
GROUP BY "Unique ID"
ORDER BY avg_assists DESC, games DESC
LIMIT 10;

-- 11) Best passer
SELECT
  MIN("Player Name") AS player_name,
  ARRAY_AGG(DISTINCT "Team") AS teams,
  COUNT(*) AS games,
  AVG("Passes Given_All Zones") AS avg_passes_given
FROM stats
GROUP BY "Unique ID"
ORDER BY avg_passes_given DESC, games DESC
LIMIT 10;

-- 12) Best receiver
SELECT
  MIN("Player Name") AS player_name,
  ARRAY_AGG(DISTINCT "Team") AS teams,
  COUNT(*) AS games,
  AVG("Passes Received_All Zones") AS avg_passes_received
FROM stats
GROUP BY "Unique ID"
ORDER BY avg_passes_received DESC, games DESC
LIMIT 10;

-- 13) Best ball security (lowest possession losses)
SELECT
  MIN("Player Name") AS player_name,
  ARRAY_AGG(DISTINCT "Team") AS teams,
  COUNT(*) AS games,
  AVG("Possession Losses_All Zones") AS avg_possession_losses
FROM stats
GROUP BY "Unique ID"
ORDER BY avg_possession_losses ASC, games DESC
LIMIT 10;

-- 14) Most interceptions
SELECT
  MIN("Player Name") AS player_name,
  ARRAY_AGG(DISTINCT "Team") AS teams,
  COUNT(*) AS games,
  AVG("Interceptions_All Zones") AS avg_interceptions
FROM stats
GROUP BY "Unique ID"
ORDER BY avg_interceptions DESC, games DESC
LIMIT 10;

-- 15) Most aerial player
SELECT
  MIN("Player Name") AS player_name,
  ARRAY_AGG(DISTINCT "Team") AS teams,
  COUNT(*) AS games,
  AVG("In Air_All Zones") AS avg_in_air
FROM stats
GROUP BY "Unique ID"
ORDER BY avg_in_air DESC, games DESC
LIMIT 10;

-- 16) Longest distance traveled
SELECT
  MIN("Player Name") AS player_name,
  ARRAY_AGG(DISTINCT "Team") AS teams,
  COUNT(*) AS games,
  AVG("Distance traveled_All Zones") AS avg_distance
FROM stats
GROUP BY "Unique ID"
ORDER BY avg_distance DESC, games DESC
LIMIT 10;

-- 17) Team with highest game win rate (roster-based, subs allowed)
WITH base AS (
  SELECT
    regexp_replace("Match ID", '-G\\d+$', '') AS series_id,
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
  AVG(CASE WHEN victory THEN 1.0 ELSE 0.0 END) AS win_rate
FROM team_game
WHERE roster IS NOT NULL
GROUP BY roster
ORDER BY win_rate DESC, games DESC
LIMIT 10;

-- 18) Team with most goals per game (roster-based, time-adjusted, subs allowed)
WITH base AS (
  SELECT
    regexp_replace("Match ID", '-G\\d+$', '') AS series_id,
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

-- 19) Best player by score per game (time-adjusted)
SELECT
  MIN("Player Name") AS player_name,
  ARRAY_AGG(DISTINCT "Team") AS teams,
  COUNT(*) AS games,
  AVG("Score_All Zones" * (300 + COALESCE("Extra Time", 0)) / 300.0) AS avg_score
FROM stats
GROUP BY "Unique ID"
ORDER BY avg_score DESC, games DESC
LIMIT 10;

-- 20) Longest overtime game
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
