{{rosterCtes}},
roster_scope AS (
  SELECT b.*, sr.roster_id
  FROM base b
  JOIN series_roster sr
    ON b.series_id = sr.series_id
   AND b.team = sr.team
  WHERE sr.roster_id = {{rosterIdParam}}
)
SELECT
  roster_scope."Season" AS season,
  COUNT(*) AS games,
  COUNT(DISTINCT roster_scope.series_id) AS series_played,
  {{goalsExpr}} AS goals,
  {{assistsExpr}} AS assists,
  {{savesExpr}} AS saves,
  {{demosExpr}} AS demos
FROM roster_scope
GROUP BY roster_scope."Season"
ORDER BY roster_scope."Season";
