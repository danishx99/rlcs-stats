-- migrate-series-id.sql
-- Backfill the materialized series_id column on stats.
-- series_id = md5(Season|Split|Regional|Day|Stage|Round|Best of|team_a|team_b)
-- where team_a/team_b are the canonical (MIN/MAX) team pair for the match.
-- Single-team matches and >2-team collisions get series_id = NULL.

ALTER TABLE stats ADD COLUMN IF NOT EXISTS series_id TEXT;

-- Recompute from scratch so existing values from older algorithms don't linger.
UPDATE stats SET series_id = NULL;

-- Index to speed up the GROUP BY and UPDATE join on Match ID + Team.
CREATE INDEX IF NOT EXISTS idx_stats_match_team ON stats ("Match ID", "Team");

WITH match_agg AS (
  SELECT
    "Match ID" AS match_id,
    MIN("Team") AS team_a,
    MAX("Team") AS team_b,
    MIN("Season") AS season,
    MIN(NULLIF("Split", '')) AS split,
    MIN(NULLIF("Regional", '')) AS regional,
    MIN("Day")::text AS day,
    MIN(NULLIF("Stage", '')) AS stage,
    MIN(NULLIF("Round", '')) AS round,
    MAX("Best of ")::text AS best_of
  FROM stats
  WHERE "Team" IS NOT NULL
    AND "Team" <> ''
  GROUP BY "Match ID"
  HAVING COUNT(DISTINCT "Team") = 2
)
UPDATE stats s
SET series_id = md5(
  COALESCE(ma.season,'') || '|' ||
  COALESCE(ma.split,'') || '|' ||
  COALESCE(ma.regional,'') || '|' ||
  COALESCE(ma.day,'') || '|' ||
  COALESCE(ma.stage,'') || '|' ||
  COALESCE(ma.round,'') || '|' ||
  COALESCE(ma.best_of,'') || '|' ||
  ma.team_a || '|' || ma.team_b
)
FROM match_agg ma
WHERE s."Match ID" = ma.match_id;

CREATE INDEX IF NOT EXISTS idx_stats_series_id ON stats (series_id);
