-- verify-series-grouping.sql
-- Sanity checks for materialized stats.series_id integrity.

WITH
series_team_counts AS (
  SELECT
    series_id,
    COUNT(DISTINCT UPPER(TRIM("Team"))) AS team_count
  FROM stats
  WHERE series_id IS NOT NULL
  GROUP BY series_id
),
match_series_counts AS (
  SELECT
    "Match ID",
    COUNT(DISTINCT series_id) FILTER (WHERE series_id IS NOT NULL) AS series_count
  FROM stats
  GROUP BY "Match ID"
),
team_case_variants AS (
  SELECT
    "Match ID",
    COUNT(DISTINCT TRIM("Team")) AS raw_team_count,
    COUNT(DISTINCT UPPER(TRIM("Team"))) AS canonical_team_count
  FROM stats
  GROUP BY "Match ID"
),
checks AS (
  SELECT
    'V01_nonnull_series_with_more_than_2_teams'::text AS check_id,
    COUNT(*) FILTER (WHERE team_count > 2)::bigint AS failures
  FROM series_team_counts

  UNION ALL

  SELECT
    'V02_nonnull_series_with_less_than_2_teams',
    COUNT(*) FILTER (WHERE team_count < 2)::bigint
  FROM series_team_counts

  UNION ALL

  SELECT
    'V03_match_ids_mapped_to_multiple_nonnull_series',
    COUNT(*) FILTER (WHERE series_count > 1)::bigint
  FROM match_series_counts

  UNION ALL

  SELECT
    'V04_match_ids_with_team_case_only_variants',
    COUNT(*) FILTER (WHERE raw_team_count <> canonical_team_count)::bigint
  FROM team_case_variants
)
SELECT
  check_id,
  CASE WHEN failures = 0 THEN 'pass' ELSE 'fail' END AS status,
  failures
FROM checks
ORDER BY check_id;
