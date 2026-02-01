WITH base AS (
  SELECT
    s.*,
    {{playerKeyExpr}} AS player_key,
    {{seriesIdExpr}} AS series_id
  FROM stats s
  {{where}}
),
player_scope AS (
  SELECT *
  FROM base
  WHERE player_key = ANY({{idsParam}})
)
SELECT
  player_scope.player_key AS id,
  COALESCE(MIN(p."Primary Handle"), MIN(player_scope."Player Name")) AS label,
  ARRAY_AGG(DISTINCT player_scope."Team") AS teams,
  COUNT(*) AS games,
  {{metricSelect}}
FROM player_scope
LEFT JOIN players p ON p."Player ID" = player_scope.player_key
GROUP BY player_scope.player_key
ORDER BY label;
