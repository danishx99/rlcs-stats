SELECT
  MIN(TRIM("Regional")) AS event_name,
  MIN(TRIM("Season")) AS season,
  MIN(TRIM("Split")) AS split,
  MIN("Date"::text) AS min_date,
  MAX("Date"::text) AS max_date,
  COUNT(DISTINCT series_id) AS total_series,
  COUNT(DISTINCT {{playerKeyExpr}}) AS total_players
FROM stats s
WHERE LOWER(TRIM("Regional")) = LOWER($1)
  AND "Regional" IS NOT NULL
  AND TRIM("Regional") <> ''
  AND ($2::text IS NULL OR LOWER(TRIM("Season")) = LOWER($2))
  AND ($3::text IS NULL OR LOWER(TRIM("Split")) = LOWER($3));
