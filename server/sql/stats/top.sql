WITH base AS (
  SELECT
    s.*,
    {{playerKeyExpr}} AS player_key
  FROM stats s
  {{where}}
),
player_scope AS (
  SELECT *
  FROM base
)
SELECT
  player_scope.player_key AS id,
  COALESCE(MIN(p."Primary Handle"), MIN(player_scope."Player Name")) AS label,
  (SELECT ARRAY_AGG(sub.team ORDER BY sub.latest_date DESC NULLS LAST) FROM (
    SELECT ps2."Team" AS team, MAX(ps2."Date") AS latest_date
    FROM player_scope ps2
    WHERE ps2.player_key = player_scope.player_key
    GROUP BY ps2."Team"
  ) sub) AS teams,
  MIN(p."Photo URL") AS photo_url,
  MIN(p."Country") AS country,
  {{valueExpr}} AS value
FROM player_scope
LEFT JOIN players p ON p."Player ID" = player_scope.player_key
GROUP BY player_scope.player_key
{{havingClause}}
ORDER BY value DESC NULLS LAST
LIMIT {{limitParam}};
