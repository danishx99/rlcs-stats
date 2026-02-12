-- series-id-preflight.sql
-- Quick health check before/after series_id backfill.
\set ON_ERROR_STOP on

WITH per_match AS (
  SELECT
    "Match ID" AS match_id,
    COUNT(DISTINCT TRIM(COALESCE("Team", ''))) FILTER (WHERE TRIM(COALESCE("Team", '')) <> '') AS team_count
  FROM stats
  GROUP BY "Match ID"
),
summary AS (
  SELECT
    current_database() AS database_name,
    COUNT(*)::INT AS total_rows,
    COUNT(*) FILTER (WHERE series_id IS NULL)::INT AS null_series_id_rows,
    COUNT(*) FILTER (WHERE series_id IS NULL OR TRIM(series_id) = '')::INT AS null_or_blank_series_id_rows,
    COUNT(DISTINCT "Match ID") FILTER (WHERE series_id IS NULL OR TRIM(series_id) = '')::INT AS affected_match_ids
  FROM stats
)
SELECT
  s.database_name,
  s.total_rows,
  s.null_series_id_rows,
  s.null_or_blank_series_id_rows,
  s.affected_match_ids,
  COUNT(*) FILTER (WHERE pm.team_count = 2)::INT AS matches_with_2_teams,
  COUNT(*) FILTER (WHERE pm.team_count <> 2)::INT AS matches_not_2_teams
FROM summary s
CROSS JOIN per_match pm
GROUP BY
  s.database_name,
  s.total_rows,
  s.null_series_id_rows,
  s.null_or_blank_series_id_rows,
  s.affected_match_ids;

SELECT
  source_file,
  COUNT(*)::INT AS missing_series_rows
FROM stats
WHERE series_id IS NULL OR TRIM(series_id) = ''
GROUP BY source_file
ORDER BY missing_series_rows DESC, source_file
LIMIT 10;

SELECT
  "Match ID" AS match_id,
  COUNT(*)::INT AS missing_series_rows
FROM stats
WHERE series_id IS NULL OR TRIM(series_id) = ''
GROUP BY "Match ID"
ORDER BY missing_series_rows DESC, match_id
LIMIT 20;
