-- issues.sql
-- Diagnostics for data completeness issues that affect "winner" tagging.
-- Summary:
-- A series winner is only taggable when a team reaches CEIL(best_of / 2.0) wins.
-- If the dataset contains only a subset of games for a series, no team reaches
-- that threshold and the series shows no winner.

-- 1) Count series with and without a winner (by series-win threshold).
WITH base AS (
  SELECT
    regexp_replace("Match ID", '-G\\d+$', '') AS series_id,
    "Best of " AS best_of,
    "Team" AS team,
    "Victory" AS victory
  FROM stats
),
series_wins AS (
  SELECT
    series_id,
    team,
    SUM(CASE WHEN victory THEN 1 ELSE 0 END) AS games_won,
    MAX(best_of) AS best_of
  FROM base
  GROUP BY series_id, team
),
winner AS (
  SELECT
    series_id,
    team AS winner_team
  FROM series_wins
  WHERE games_won >= CEIL(best_of / 2.0)
)
SELECT
  COUNT(DISTINCT series_id) AS total_series,
  COUNT(DISTINCT winner.series_id) AS series_with_winner,
  COUNT(DISTINCT series_id) - COUNT(DISTINCT winner.series_id) AS series_without_winner
FROM base
LEFT JOIN winner USING (series_id);

-- 2) Breakdown of series WITHOUT a winner by best_of and max wins.
-- This shows incomplete series (e.g. Bo7 where max wins = 3).
WITH base AS (
  SELECT
    regexp_replace("Match ID", '-G\\d+$', '') AS series_id,
    "Best of " AS best_of,
    "Team" AS team,
    "Victory" AS victory
  FROM stats
),
series_wins AS (
  SELECT
    series_id,
    team,
    SUM(CASE WHEN victory THEN 1 ELSE 0 END) AS games_won,
    MAX(best_of) AS best_of
  FROM base
  GROUP BY series_id, team
),
series_max AS (
  SELECT
    series_id,
    MAX(games_won) AS max_games_won,
    MAX(best_of) AS best_of
  FROM series_wins
  GROUP BY series_id
),
winners AS (
  SELECT series_id
  FROM series_wins
  WHERE games_won >= CEIL(best_of / 2.0)
)
SELECT
  best_of,
  max_games_won,
  COUNT(*) AS series_count
FROM series_max
WHERE series_id NOT IN (SELECT series_id FROM winners)
GROUP BY best_of, max_games_won
ORDER BY best_of, max_games_won;

-- 3) Example: inspect one incomplete series (Bo7 with max wins = 3).
-- Replace :series_id with an actual series_id from query #2 (example shown below).
-- Example fetch:
--   SELECT series_id
--   FROM (
--     SELECT series_id, MAX(games_won) AS max_games_won, MAX(best_of) AS best_of
--     FROM (
--       SELECT series_id, team,
--         SUM(CASE WHEN victory THEN 1 ELSE 0 END) AS games_won,
--         MAX(best_of) AS best_of
--       FROM (
--         SELECT
--           regexp_replace("Match ID", '-G\\d+$', '') AS series_id,
--           "Best of " AS best_of,
--           "Team" AS team,
--           "Victory" AS victory
--         FROM stats
--       ) b
--       GROUP BY series_id, team
--     ) sw
--     GROUP BY series_id
--   ) s
--   WHERE best_of = 7 AND max_games_won = 3
--   LIMIT 1;
--
-- Then inspect the series games:
--   SELECT
--     "Match ID",
--     "Game Number",
--     "Team",
--     "Player Name",
--     "Victory"
--   FROM stats
--   WHERE regexp_replace("Match ID", '-G\\d+$', '') = :series_id
--   ORDER BY "Match ID", "Team", "Player Name";
