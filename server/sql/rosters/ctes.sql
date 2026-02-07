WITH base AS (
  SELECT
    s.*,
    TRIM(s."Team") AS team,
    {{playerKeyExpr}} AS player_key
  FROM stats s
  {{where}}
),
series_roster AS (
  SELECT
    series_id,
    team,
    ARRAY_AGG(DISTINCT player_key ORDER BY player_key) AS starters,
    md5(array_to_string(ARRAY_AGG(DISTINCT player_key ORDER BY player_key), '|')) AS roster_id
  FROM base
  WHERE player_key IS NOT NULL
    AND series_id IS NOT NULL
  GROUP BY series_id, team
  HAVING COUNT(DISTINCT player_key) = 3
),
roster_counts AS (
  SELECT
    roster_id,
    team,
    COUNT(*) AS series_count
  FROM series_roster
  GROUP BY roster_id, team
),
roster_names AS (
  SELECT DISTINCT ON (roster_id)
    roster_id,
    team AS roster_name
  FROM roster_counts
  ORDER BY roster_id, series_count DESC, team
)
