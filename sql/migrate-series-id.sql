-- migrate-series-id.sql
-- Backfill the materialized series_id column on stats.
-- series_id = md5(Season|Split|Regional|Day|Stage|Round|Best of|team_a|team_b)
-- where team_a/team_b are the canonical (LEAST/GREATEST) team pair for the match.
-- Single-team matches and >2-team collisions get series_id = NULL.

ALTER TABLE stats ADD COLUMN IF NOT EXISTS series_id TEXT;

-- Recompute from scratch so existing values from older algorithms don't linger.
UPDATE stats SET series_id = NULL;

WITH base AS (
  SELECT
    "Match ID" AS match_id,
    UPPER(TRIM("Team")) AS team_norm,
    "Season" AS season,
    TRIM("Split") AS split,
    TRIM("Regional") AS regional,
    "Day" AS day,
    TRIM("Stage") AS stage,
    TRIM("Round") AS round,
    "Best of " AS best_of
  FROM stats
),
match_teams AS (
  SELECT DISTINCT match_id, team_norm
  FROM base
  WHERE team_norm <> ''
),
two_team_matches AS (
  SELECT match_id
  FROM match_teams
  GROUP BY match_id
  HAVING COUNT(DISTINCT team_norm) = 2
),
team_pairs AS (
  SELECT DISTINCT
    mt1.match_id,
    LEAST(mt1.team_norm, mt2.team_norm) AS team_a,
    GREATEST(mt1.team_norm, mt2.team_norm) AS team_b
  FROM match_teams mt1
  JOIN match_teams mt2
    ON mt1.match_id = mt2.match_id AND mt1.team_norm < mt2.team_norm
  JOIN two_team_matches ttm ON ttm.match_id = mt1.match_id
),
match_meta AS (
  SELECT
    b.match_id,
    MIN(b.season) AS season,
    MIN(NULLIF(b.split, '')) AS split,
    MIN(NULLIF(b.regional, '')) AS regional,
    MIN(b.day)::text AS day,
    MIN(NULLIF(b.stage, '')) AS stage,
    MIN(NULLIF(b.round, '')) AS round,
    MAX(b.best_of)::text AS best_of
  FROM base b
  JOIN two_team_matches ttm ON ttm.match_id = b.match_id
  GROUP BY b.match_id
)
UPDATE stats s
SET series_id = md5(
  COALESCE(mm.season,'') || '|' ||
  COALESCE(mm.split,'') || '|' ||
  COALESCE(mm.regional,'') || '|' ||
  COALESCE(mm.day,'') || '|' ||
  COALESCE(mm.stage,'') || '|' ||
  COALESCE(mm.round,'') || '|' ||
  COALESCE(mm.best_of,'') || '|' ||
  tp.team_a || '|' || tp.team_b
)
FROM team_pairs tp
JOIN match_meta mm ON mm.match_id = tp.match_id
WHERE s."Match ID" = tp.match_id
  AND UPPER(TRIM(s."Team")) IN (tp.team_a, tp.team_b);

CREATE INDEX IF NOT EXISTS idx_stats_series_id ON stats (series_id);
