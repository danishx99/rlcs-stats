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

-- ============================================================================
-- 4) Known data quality issues
-- ============================================================================

-- Issue: Victory=false for BOTH teams in some games
-- Example: 2021-11-12, Season 2021-22, Fall, Regional Event 2, Swiss, Round 3,
--          Game 2 — BRAVADO GAMING vs EXOTIC ESPORTS.
--          BVD scored 2 goals, EXO scored 1, but Victory=false for both teams.
--          This causes the game to count as a win for neither team in series
--          score calculations.
--
-- Issue: Fractional / interpolated stats for some players
-- Example: Same series above — EXOTIC ESPORTS players in games 1 and 3 have
--          fractional values (e.g. 0.72 goals, 0.93 assists) instead of whole
--          numbers, suggesting averaged or imputed data rather than raw game stats.
--
-- Issue: Missing team rows in some games
-- Example: Same series — Game 4 has BRAVADO GAMING rows but no EXOTIC ESPORTS
--          rows at all. Game 3 shows a substitute (TechnicEagle75 replaces
--          Sweaty_Clarence) while other players are absent in later games.
--
-- Impact: Head-to-head series scores may be incorrect when:
--   a) A game has Victory=false for both teams (no winner — undercounts)
--   b) A game has Victory=true for both teams (double winner — overcounts)
--   c) A player is subbed out or missing from later games in a series
-- The history SQL was updated to count wins from ALL games in a matched series
-- rather than only games where both selected players had data rows.
--
-- Issue: Victory=true for BOTH teams in some games
-- Example: 2023-05-12, Season 2022-23, Spring, Open, Double Elim, Upper QF,
--          Games 1 & 2 — FRENCH CLASS vs LIMITLESS.
--          Both teams have Victory=true, causing each game to count as a win
--          for both sides. In a Bo5, this produces impossible scores like 3-3.
--          Correlates with fractional/normalised stats on one team (LIMITLESS
--          shows 0.89 goals in game 1), suggesting imputed data where the
--          Victory flag was incorrectly set to true.
--
-- Diagnostic query for double-win games:
--   SELECT "Date"::date, "Season", "Split", "Regional", "Stage", "Round",
--          "Game Number", "Team", "Player Name", "Victory",
--          "Goals_All Zones", "Score_All Zones"
--   FROM stats
--   WHERE "Date"::text LIKE '2021-11-12%'
--     AND "Season" = '2021-22' AND "Split" = 'Fall'
--     AND "Regional" = 'Regional Event 2'
--     AND "Stage" = 'Swiss' AND "Round" = '3'
--     AND "Team" IN ('BRAVADO GAMING', 'EXOTIC ESPORTS')
--   ORDER BY "Game Number", "Team", "Player Name";
