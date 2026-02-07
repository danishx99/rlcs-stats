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
  WHERE player_key = ANY({{idsParam}})
)
SELECT
  player_scope.player_key AS id,
  COALESCE(MIN(p."Primary Handle"), MIN(player_scope."Player Name")) AS label,
  (SELECT ARRAY_AGG(sub.team ORDER BY sub.latest_date DESC NULLS LAST) FROM (
    SELECT player_scope2."Team" AS team, MAX(player_scope2."Date") AS latest_date
    FROM base player_scope2
    WHERE player_scope2.player_key = player_scope.player_key
    GROUP BY player_scope2."Team"
  ) sub) AS teams,
  COUNT(*) AS games,
  {{metricSelect}}
FROM player_scope
LEFT JOIN players p ON p."Player ID" = player_scope.player_key
GROUP BY player_scope.player_key
ORDER BY label;
