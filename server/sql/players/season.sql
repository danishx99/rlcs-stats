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
  WHERE player_key = {{playerIdParam}}
)
SELECT
  player_scope."Season" AS season,
  COUNT(*) AS games,
  COUNT(DISTINCT player_scope.series_id) AS series_played,
  {{goalsExpr}} AS goals,
  {{assistsExpr}} AS assists,
  {{savesExpr}} AS saves,
  {{demosExpr}} AS demos
FROM player_scope
GROUP BY player_scope."Season"
ORDER BY player_scope."Season";
