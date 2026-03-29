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
  WHERE player_key = {{playerIdParam}}
)
SELECT
  player_scope."Season" AS season,
  COUNT(*) AS games,
  COUNT(DISTINCT player_scope.series_id) AS series_played,
  {{goalsPrimaryExpr}} AS goals,
  {{goalsAvgExpr}} AS goals_avg,
  {{goalsTotalExpr}} AS goals_total,
  {{assistsPrimaryExpr}} AS assists,
  {{assistsAvgExpr}} AS assists_avg,
  {{assistsTotalExpr}} AS assists_total,
  {{savesPrimaryExpr}} AS saves,
  {{savesAvgExpr}} AS saves_avg,
  {{savesTotalExpr}} AS saves_total,
  {{demosPrimaryExpr}} AS demos,
  {{demosAvgExpr}} AS demos_avg,
  {{demosTotalExpr}} AS demos_total
FROM player_scope
GROUP BY player_scope."Season"
ORDER BY player_scope."Season";
