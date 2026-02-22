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

-- -------------------------------------------------------------------------
-- ISSUE A: Match ID collisions — concurrent matches share identical IDs
-- -------------------------------------------------------------------------
-- Root cause: Some CSVs use HH:MM timestamps (minute precision) instead of
-- HHMMSS (second precision). When two matches start at the same minute in
-- the same round, they get identical Match IDs, merging 4 teams into one game.
--
-- Scale: 6 Match IDs affected (all with 4 teams instead of 2).
--   - 2021-22 Fall, Event 2, Swiss Round 2: 1 collision
--   - 2022-23 Winter, Open, Groups Round 1: 2 collisions
--   - 2022-23 Winter, Open, Groups Round 2: 2 collisions
--   - 2022-23 Winter, Open, Playoffs Round 1: 1 collision
--
-- Timestamp format distribution: 1668 Match IDs use HHMMSS, 130 use HH:MM.
--
-- Example: Match ID 20230127-17:06-2022-23-Winter-Open-Groups-1-G1
--   contains ATK vs NKOSI BALLERS AND ASTRONIC ESPORTS vs LIMITLESS
--   (two concurrent matches at 17:06, same round).

-- 4a) Find all Match IDs with more than 2 teams (direct collision evidence).
SELECT
  "Match ID",
  COUNT(DISTINCT "Team") AS team_count,
  ARRAY_AGG(DISTINCT "Team" ORDER BY "Team") AS teams
FROM stats
GROUP BY "Match ID"
HAVING COUNT(DISTINCT "Team") > 2
ORDER BY "Match ID";

-- -------------------------------------------------------------------------
-- ISSUE B: series_id collisions — timestamp stripping merges unrelated matches
-- -------------------------------------------------------------------------
-- Root cause: seriesIdExpr strips HHMMSS timestamps with regex '-[0-9]{6}-'
-- then removes the game suffix. This collapses ALL concurrent matches in the
-- same round on the same day into a single series_id.
--
-- Format: YYYYMMDD-HHMMSS-Season-Split-Event-Stage-Round-G#
--   → strips HHMMSS → YYYYMMDD-Season-Split-Event-Stage-Round
--
-- Note: HH:MM timestamps are NOT stripped (regex doesn't match), so those
-- keep their timestamps in the series_id. Only HHMMSS (1668/1798 Match IDs)
-- is affected.
--
-- Scale: Extreme collisions — up to 40 Match IDs mapping to one series_id.
--   Series with 1 team:  46   (single-team data only)
--   Series with 2 teams: 143  (correct)
--   Series with 3+ teams: 92  (collisions)
--   Worst case: 16 teams in one "series" (8 concurrent matches merged)
--
-- Impact on:
--   - Compare history: phantom matchups between teams that never played each other
--   - Series win counting: impossible scores like 3-3 in a Bo5
--   - Roster/player profiles: inflated series/game counts, wrong best results
--   - Featured leaderboards: polluted aggregates

-- 4b) Series with more than 2 teams (series_id collision).
WITH series_teams AS (
  SELECT
    regexp_replace(regexp_replace("Match ID", '-[0-9]{6}-', '-'), '-G[0-9]+$', '') AS series_id,
    COUNT(DISTINCT "Team") AS team_count
  FROM stats
  GROUP BY regexp_replace(regexp_replace("Match ID", '-[0-9]{6}-', '-'), '-G[0-9]+$', '')
)
SELECT team_count, COUNT(*) AS series_count
FROM series_teams
GROUP BY team_count
ORDER BY team_count;

-- 4c) Worst-case series_id collisions (16+ teams).
WITH series_teams AS (
  SELECT
    regexp_replace(regexp_replace("Match ID", '-[0-9]{6}-', '-'), '-G[0-9]+$', '') AS series_id,
    ARRAY_AGG(DISTINCT "Team" ORDER BY "Team") AS teams,
    COUNT(DISTINCT "Team") AS team_count
  FROM stats
  GROUP BY regexp_replace(regexp_replace("Match ID", '-[0-9]{6}-', '-'), '-G[0-9]+$', '')
  HAVING COUNT(DISTINCT "Team") > 8
)
SELECT series_id, team_count
FROM series_teams
ORDER BY team_count DESC;

-- -------------------------------------------------------------------------
-- ISSUE C: Victory=false for BOTH teams in some games
-- -------------------------------------------------------------------------
-- 178 games (169 in 2021-22, 9 in 2022-23) where neither team has Victory=true.
-- Causes series win undercounts (no winner recorded for that game).
--
-- Example: 2021-11-12, Season 2021-22, Fall, Event 2, Swiss, Round 3,
--          Game 2 — BRAVADO GAMING vs EXOTIC ESPORTS.
--          BVD scored 2 goals, EXO scored 1, but Victory=false for both teams.

-- 4d) Count games with no winner by season.
WITH game_victories AS (
  SELECT
    "Match ID",
    "Season",
    "Team",
    bool_or("Victory") AS team_won
  FROM stats
  GROUP BY "Match ID", "Season", "Team"
),
no_wins AS (
  SELECT "Match ID", "Season"
  FROM game_victories
  GROUP BY "Match ID", "Season"
  HAVING bool_or(team_won) = false
)
SELECT "Season", COUNT(*) AS no_winner_games
FROM no_wins
GROUP BY "Season"
ORDER BY "Season";

-- -------------------------------------------------------------------------
-- ISSUE D: Victory=true for BOTH teams in some games
-- -------------------------------------------------------------------------
-- 6 games where two teams both have Victory=true. All are caused by Match ID
-- collisions (Issue A) — two concurrent matches merged into one game, each
-- with their own winner. NOT a Victory flag data error per se, but rather
-- a consequence of the ID collision.
--
-- Previously suspected: CSV data quality issue with Victory flag incorrectly
-- set. Investigation reveals the actual cause is Match ID collision, not
-- bad Victory values.

-- 4e) Find all games where both teams claim victory.
WITH game_victories AS (
  SELECT
    "Match ID",
    "Date"::date AS date,
    "Season",
    "Split",
    "Event",
    "Stage",
    "Round",
    "Game Number",
    "Team",
    bool_or("Victory") AS team_won
  FROM stats
  GROUP BY "Match ID", "Date"::date, "Season", "Split", "Event",
           "Stage", "Round", "Game Number", "Team"
),
double_wins AS (
  SELECT "Match ID", "Game Number"
  FROM game_victories
  WHERE team_won = true
  GROUP BY "Match ID", "Game Number"
  HAVING COUNT(*) > 1
)
SELECT g.date, g."Season", g."Split", g."Event", g."Stage", g."Round",
       g."Game Number", g."Team", g.team_won
FROM game_victories g
JOIN double_wins d ON g."Match ID" = d."Match ID" AND g."Game Number" = d."Game Number"
ORDER BY g.date, g."Match ID", g."Game Number", g."Team";

-- -------------------------------------------------------------------------
-- ISSUE E: Fractional / interpolated stats in some rows
-- -------------------------------------------------------------------------
-- Some player rows have fractional values for count-based stats (e.g. 0.72
-- goals, 0.93 assists) instead of whole numbers. This suggests averaged or
-- imputed data rather than raw game stats.
--
-- Stats are normalised to 300-second game length in the source data. For
-- overtime games, count-based stats get scaled down (e.g. a goal scored at
-- 310s becomes 0.97). This is handled by denormExpr() in the codebase which
-- reverses the normalisation: ROUND(value * (300 + "Extra Time") / 300).
--
-- However, some fractional values appear in non-OT games too, suggesting
-- the source data may have additional interpolation/imputation beyond just
-- time-normalisation.

-- -------------------------------------------------------------------------
-- ISSUE F: Missing team rows in some games
-- -------------------------------------------------------------------------
-- Some games have rows for one team but not the other. This causes:
--   - One-sided series data (only one team's perspective recorded)
--   - Incomplete win counts
--   - 338 Match IDs with only 1 team (see query 4a context)
--
-- Example: BRAVADO vs EXOTIC series — Game 4 has BRAVADO rows but no EXOTIC
--          rows at all.

-- 4f) Count of games with only one team.
SELECT COUNT(*) AS single_team_games
FROM (
  SELECT "Match ID"
  FROM stats
  GROUP BY "Match ID"
  HAVING COUNT(DISTINCT "Team") = 1
) sub;

-- -------------------------------------------------------------------------
-- Summary of impact on compare history
-- -------------------------------------------------------------------------
-- Compare history shows impossible series scores (e.g. 3-3 in a Bo5) due to:
--   1. series_id collisions (Issue B): teams that never played each other
--      appear in the same "series", inflating both sides' win counts
--   2. Match ID collisions (Issue A): 4 teams in one game, 2 winners
--   3. Victory=false for both (Issue C): undercounts real wins
--   4. Missing team rows (Issue F): one-sided data skews scores
--
-- The primary fix would be to improve seriesIdExpr to preserve timestamps
-- (or use the full Match ID minus game suffix) so concurrent matches stay
-- separate. This would resolve Issues A, B, and D simultaneously.
