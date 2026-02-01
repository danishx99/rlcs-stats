WITH base AS (
  SELECT
    {{playerKeyExpr}} AS player_key,
    COALESCE(p."Primary Handle", s."Player Name") AS label,
    p."All Aliases" AS aliases,
    p."Real Name" AS real_name,
    p."Photo URL" AS photo_url,
    p."Country" AS country,
    s."Player Name" AS player_name
  FROM stats s
  LEFT JOIN players p ON p."Player ID" = {{playerKeyExpr}}
)
SELECT DISTINCT ON (player_key)
  player_key AS id,
  label,
  real_name,
  photo_url,
  country
FROM base
WHERE label ILIKE $1
   OR aliases ILIKE $1
   OR real_name ILIKE $1
   OR player_name ILIKE $1
ORDER BY player_key, label
LIMIT $2;
