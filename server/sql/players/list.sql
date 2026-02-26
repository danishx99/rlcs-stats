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
  MIN(p.aka) AS aliases,
  MIN(p."Country") AS country,
  MIN(p."Photo URL") AS photo_url,
  (SELECT ARRAY_AGG(sub.team ORDER BY sub.latest_date DESC NULLS LAST) FROM (
    SELECT b2."Team" AS team, MAX(b2."Date") AS latest_date
    FROM base b2
    WHERE b2.player_key = base.player_key
    GROUP BY b2."Team"
  ) sub) AS teams,
  COUNT(*) AS games
FROM base
LEFT JOIN players p ON p."Unique ID" = base.player_key
GROUP BY base.player_key
ORDER BY games DESC
LIMIT {{limitParam}}
OFFSET {{offsetParam}};
