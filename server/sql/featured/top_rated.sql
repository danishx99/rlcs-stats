WITH base AS (
  SELECT s.*, {{playerKeyExpr}} AS player_key
  FROM stats s
  {{where}}
)
SELECT
  base.player_key AS id,
  COALESCE(MIN(p."Primary Handle"), MIN(base."Player Name")) AS label,
  (SELECT ARRAY_AGG(sub.team ORDER BY sub.latest_date DESC NULLS LAST) FROM (
    SELECT b2."Team" AS team, MAX(b2."Date") AS latest_date
    FROM base b2 WHERE b2.player_key = base.player_key GROUP BY b2."Team"
  ) sub) AS teams,
  MIN(p."Photo URL") AS photo_url,
  MIN(p."Country") AS country,
  (
    AVG(base."Goals_All Zones") * 2.0 +
    AVG(base."Assists_All Zones") * 2.0 +
    COALESCE(SUM(base."Goals_All Zones")::float / NULLIF(SUM(base."Shots_All Zones"), 0), 0) * 0.5 +
    AVG(base."Shots_All Zones") * 0.5 +
    (AVG(base."Kills_All Zones") - AVG(base."Deaths_All Zones")) * 0.2
  ) AS value,
  COUNT(*) AS games,
  AVG(base."Goals_All Zones") AS goals_avg,
  AVG(base."Assists_All Zones") AS assists_avg,
  COALESCE(SUM(base."Goals_All Zones")::float / NULLIF(SUM(base."Shots_All Zones"), 0), 0) * 100 AS shooting_pct,
  AVG(base."Kills_All Zones") - AVG(base."Deaths_All Zones") AS demo_diff
FROM base
LEFT JOIN players p ON p."Unique ID" = base.player_key
WHERE base.player_key IS NOT NULL
GROUP BY base.player_key
HAVING COUNT(*) >= 10
ORDER BY value DESC, COUNT(*) DESC
LIMIT {{limitParam}};
