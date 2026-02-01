WITH base AS (
  SELECT
    s.*,
    {{playerKeyExpr}} AS player_key
  FROM stats s
  {{where}}
)
SELECT
  base.player_key AS id,
  COALESCE(MIN(p."Primary Handle"), MIN(base."Player Name")) AS label,
  MIN(p."All Aliases") AS aliases,
  MIN(p."Country") AS country,
  MIN(p."Photo URL") AS photo_url,
  ARRAY_AGG(DISTINCT base."Team") AS teams,
  COUNT(*) AS games
FROM base
LEFT JOIN players p ON p."Player ID" = base.player_key
GROUP BY base.player_key
ORDER BY games DESC
LIMIT {{limitParam}}
OFFSET {{offsetParam}};
