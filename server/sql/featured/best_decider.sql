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
  ROUND((AVG(CASE WHEN base."Victory" THEN 1.0 ELSE 0.0 END) * 100.0)::NUMERIC, 2) AS value
FROM base
LEFT JOIN players p ON p."Player ID" = base.player_key
WHERE base.player_key IS NOT NULL
  AND base."Best of " IN (5, 7)
  AND base."Game Number" = base."Best of "
GROUP BY base.player_key
HAVING COUNT(*) >= 5
ORDER BY value DESC, COUNT(*) DESC
LIMIT {{limitParam}};
