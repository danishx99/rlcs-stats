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
  ARRAY_AGG(DISTINCT player_scope."Team") AS teams,
  MIN(p."Photo URL") AS photo_url,
  MIN(p."Country") AS country,
  {{valueExpr}} AS value
FROM player_scope
LEFT JOIN players p ON p."Player ID" = player_scope.player_key
GROUP BY player_scope.player_key
ORDER BY value DESC NULLS LAST
LIMIT {{limitParam}};
