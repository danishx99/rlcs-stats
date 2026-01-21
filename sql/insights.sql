-- Normalized per-300s stats are denormalized using:
--   raw_value = normalized_value * (300 + COALESCE("Extra Time", 0)) / 300.0
-- Use series_id to group full series (Match ID includes game suffix like -G1).

-- 1) Highest scoring series (total goals, denormalized)
SELECT *
FROM (
  SELECT
    regexp_replace("Match ID", '-G\\d+$', '') AS series_id,
    MIN("Team") AS team_a,
    MAX("Team") AS team_b,
    MIN("Best of ") AS best_of,
    ROUND(SUM("Goals_All Zones" * (300 + COALESCE("Extra Time", 0)) / 300.0))::INT AS total_goals,
    ROUND(SUM("Score_All Zones" * (300 + COALESCE("Extra Time", 0)) / 300.0))::INT AS total_score
  FROM stats
  GROUP BY regexp_replace("Match ID", '-G\\d+$', '')
) series
ORDER BY total_goals DESC
LIMIT 1;

-- 2) Least grounded player (lowest avg on-ground %)
SELECT
  "Player Name" AS player_name,
  ARRAY_AGG(DISTINCT "Team") AS teams,
  COUNT(*) AS games,
  AVG("On Ground_All Zones") AS avg_on_ground
FROM stats
GROUP BY "Player Name"
ORDER BY avg_on_ground ASC, games DESC
LIMIT 1;

-- 3) Best player in grand finals (highest win rate)
SELECT
  "Player Name" AS player_name,
  ARRAY_AGG(DISTINCT "Team") AS teams,
  COUNT(*) AS games,
  SUM(CASE WHEN "Victory" THEN 1 ELSE 0 END) AS wins,
  AVG(CASE WHEN "Victory" THEN 1.0 ELSE 0.0 END) AS win_rate
FROM stats
WHERE "Stage" = 'Playoff'
  AND "Match ID" LIKE '%Playoff-GF%'
GROUP BY "Player Name"
ORDER BY win_rate DESC, games DESC
LIMIT 1;

-- 4) Best player in deciding game (Game 5 or 7)
SELECT
  "Player Name" AS player_name,
  ARRAY_AGG(DISTINCT "Team") AS teams,
  COUNT(*) AS games,
  SUM(CASE WHEN "Victory" THEN 1 ELSE 0 END) AS wins,
  AVG(CASE WHEN "Victory" THEN 1.0 ELSE 0.0 END) AS win_rate
FROM stats
WHERE "Best of " IN (5, 7)
  AND "Game Number" = "Best of "
GROUP BY "Player Name"
ORDER BY win_rate DESC, games DESC
LIMIT 1;

-- 5) Fastest player (highest avg speed)
SELECT
  "Player Name" AS player_name,
  ARRAY_AGG(DISTINCT "Team") AS teams,
  COUNT(*) AS games,
  AVG("Average Speed_All Zones") AS avg_speed
FROM stats
GROUP BY "Player Name"
ORDER BY avg_speed DESC, games DESC
LIMIT 1;

-- 6) Most successful team (most series wins)
WITH base AS (
  SELECT
    regexp_replace("Match ID", '-G\\d+$', '') AS series_id,
    "Team" AS team,
    "Game Number" AS game_number,
    "Victory" AS victory,
    "Best of " AS best_of
  FROM stats
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
)
SELECT
  team,
  COUNT(*) AS series_wins
FROM series_winners
GROUP BY team
ORDER BY series_wins DESC
LIMIT 1;

-- 7) Best OT performer (highest OT win rate)
SELECT
  "Player Name" AS player_name,
  ARRAY_AGG(DISTINCT "Team") AS teams,
  COUNT(*) AS ot_games,
  SUM(CASE WHEN "Victory" THEN 1 ELSE 0 END) AS ot_wins,
  AVG(CASE WHEN "Victory" THEN 1.0 ELSE 0.0 END) AS win_rate
FROM stats
WHERE "OT" = true
GROUP BY "Player Name"
ORDER BY win_rate DESC, ot_games DESC
LIMIT 1;

-- 8) Most demos per game
SELECT
  "Player Name" AS player_name,
  ARRAY_AGG(DISTINCT "Team") AS teams,
  COUNT(*) AS games,
  AVG("Kills_All Zones") AS avg_kills
FROM stats
GROUP BY "Player Name"
ORDER BY avg_kills DESC, games DESC
LIMIT 1;

-- 9) Best shooting accuracy (denormalized counts)
SELECT
  "Player Name" AS player_name,
  ARRAY_AGG(DISTINCT "Team") AS teams,
  ROUND(SUM("Shots_All Zones" * (300 + COALESCE("Extra Time", 0)) / 300.0))::INT AS shots,
  ROUND(SUM("Goals_All Zones" * (300 + COALESCE("Extra Time", 0)) / 300.0))::INT AS goals,
  SUM("Goals_All Zones" * (300 + COALESCE("Extra Time", 0)) / 300.0)
    / NULLIF(SUM("Shots_All Zones" * (300 + COALESCE("Extra Time", 0)) / 300.0), 0) AS accuracy
FROM stats
GROUP BY "Player Name"
ORDER BY accuracy DESC, shots DESC
LIMIT 1;

-- 10) Top assist rate (denormalized)
SELECT
  "Player Name" AS player_name,
  ARRAY_AGG(DISTINCT "Team") AS teams,
  COUNT(*) AS games,
  AVG("Assists_All Zones" * (300 + COALESCE("Extra Time", 0)) / 300.0) AS avg_assists
FROM stats
GROUP BY "Player Name"
ORDER BY avg_assists DESC, games DESC
LIMIT 1;

-- 11) Best passer
SELECT
  "Player Name" AS player_name,
  ARRAY_AGG(DISTINCT "Team") AS teams,
  COUNT(*) AS games,
  AVG("Passes Given_All Zones") AS avg_passes_given
FROM stats
GROUP BY "Player Name"
ORDER BY avg_passes_given DESC, games DESC
LIMIT 1;

-- 12) Best receiver
SELECT
  "Player Name" AS player_name,
  ARRAY_AGG(DISTINCT "Team") AS teams,
  COUNT(*) AS games,
  AVG("Passes Received_All Zones") AS avg_passes_received
FROM stats
GROUP BY "Player Name"
ORDER BY avg_passes_received DESC, games DESC
LIMIT 1;

-- 13) Best ball security (lowest possession losses)
SELECT
  "Player Name" AS player_name,
  ARRAY_AGG(DISTINCT "Team") AS teams,
  COUNT(*) AS games,
  AVG("Possession Losses_All Zones") AS avg_possession_losses
FROM stats
GROUP BY "Player Name"
ORDER BY avg_possession_losses ASC, games DESC
LIMIT 1;

-- 14) Most interceptions
SELECT
  "Player Name" AS player_name,
  ARRAY_AGG(DISTINCT "Team") AS teams,
  COUNT(*) AS games,
  AVG("Interceptions_All Zones") AS avg_interceptions
FROM stats
GROUP BY "Player Name"
ORDER BY avg_interceptions DESC, games DESC
LIMIT 1;

-- 15) Most aerial player
SELECT
  "Player Name" AS player_name,
  ARRAY_AGG(DISTINCT "Team") AS teams,
  COUNT(*) AS games,
  AVG("In Air_All Zones") AS avg_in_air
FROM stats
GROUP BY "Player Name"
ORDER BY avg_in_air DESC, games DESC
LIMIT 1;

-- 16) Longest distance traveled
SELECT
  "Player Name" AS player_name,
  ARRAY_AGG(DISTINCT "Team") AS teams,
  COUNT(*) AS games,
  AVG("Distance traveled_All Zones") AS avg_distance
FROM stats
GROUP BY "Player Name"
ORDER BY avg_distance DESC, games DESC
LIMIT 1;

-- 17) Team with highest game win rate
SELECT
  "Team" AS team,
  COUNT(*) AS games,
  SUM(CASE WHEN "Victory" THEN 1 ELSE 0 END) AS wins,
  AVG(CASE WHEN "Victory" THEN 1.0 ELSE 0.0 END) AS win_rate
FROM (
  SELECT DISTINCT "Match ID", "Game Number", "Team", "Victory"
  FROM stats
) t
GROUP BY "Team"
ORDER BY win_rate DESC, games DESC
LIMIT 1;

-- 18) Team with most goals per game (denormalized)
WITH team_game_goals AS (
  SELECT
    regexp_replace("Match ID", '-G\\d+$', '') AS series_id,
    "Game Number" AS game_number,
    "Team" AS team,
    ROUND(SUM("Goals_All Zones" * (300 + COALESCE("Extra Time", 0)) / 300.0))::INT AS team_goals
  FROM stats
  GROUP BY regexp_replace("Match ID", '-G\\d+$', ''), "Game Number", "Team"
)
SELECT
  team,
  COUNT(*) AS games,
  AVG(team_goals) AS avg_team_goals
FROM team_game_goals
GROUP BY team
ORDER BY avg_team_goals DESC, games DESC
LIMIT 1;

-- 19) Best player by score per game (denormalized)
SELECT
  "Player Name" AS player_name,
  ARRAY_AGG(DISTINCT "Team") AS teams,
  COUNT(*) AS games,
  AVG("Score_All Zones" * (300 + COALESCE("Extra Time", 0)) / 300.0) AS avg_score
FROM stats
GROUP BY "Player Name"
ORDER BY avg_score DESC, games DESC
LIMIT 1;

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
LIMIT 1;
