WITH base AS (
  SELECT
    {{playerKeyExpr}} AS player_key,
    COALESCE(p."Primary Handle", s."Player Name") AS label,
    p.aka AS aliases,
    p."Real Name" AS real_name,
    p."Photo URL" AS photo_url,
    p."Country" AS country,
    s."Player Name" AS player_name
  FROM stats s
  LEFT JOIN players p ON p."Unique ID" = {{playerKeyExpr}}
  {{where}}
)
SELECT DISTINCT ON (player_key)
  player_key AS id,
  label,
  real_name,
  photo_url,
  country
FROM base
WHERE label ILIKE {{likeParam}}
   OR aliases ILIKE {{likeParam}}
   OR real_name ILIKE {{likeParam}}
   OR player_name ILIKE {{likeParam}}
ORDER BY player_key, label
LIMIT {{limitParam}};
