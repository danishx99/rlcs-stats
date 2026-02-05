WITH base AS (
  SELECT s.*, {{playerKeyExpr}} AS player_key
  FROM stats s
  {{where}}
)
SELECT
  base.player_key AS id,
  COALESCE(MIN(p."Primary Handle"), MIN(base."Player Name")) AS label,
  ARRAY_AGG(DISTINCT base."Team") AS teams,
  MIN(p."Photo URL") AS photo_url,
  MIN(p."Country") AS country,
  AVG(base."On Ground_All Zones") AS value,
  COUNT(*) AS games,
  AVG(base."In Air_All Zones") AS in_air,
  AVG(base."Average Speed_All Zones") AS avg_speed
FROM base
LEFT JOIN players p ON p."Player ID" = base.player_key
WHERE base.player_key IS NOT NULL
GROUP BY base.player_key
ORDER BY value ASC, COUNT(*) DESC
LIMIT {{limitParam}};
