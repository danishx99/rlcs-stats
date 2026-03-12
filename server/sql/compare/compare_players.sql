WITH player_scope AS (
  SELECT
    s.*,
    {{playerKeyExpr}} AS player_key
  FROM stats s
  WHERE {{playerKeyExpr}} = ANY({{idsParam}})
    {{filterClauses}}
),
player_teams AS (
  SELECT
    team_rollup.player_key,
    ARRAY_AGG(team_rollup.team ORDER BY team_rollup.latest_date DESC NULLS LAST) AS teams
  FROM (
    SELECT
      player_scope.player_key,
      player_scope."Team" AS team,
      MAX(player_scope."Date") AS latest_date
    FROM player_scope
    GROUP BY player_scope.player_key, player_scope."Team"
  ) team_rollup
  GROUP BY team_rollup.player_key
)
SELECT
  player_scope.player_key AS id,
  COALESCE(MIN(p."Primary Handle"), MIN(player_scope."Player Name")) AS label,
  COALESCE(player_teams.teams, ARRAY[]::text[]) AS teams,
  COUNT(*) AS games,
  {{metricSelect}}
FROM player_scope
LEFT JOIN players p ON p."Unique ID" = player_scope.player_key
LEFT JOIN player_teams ON player_teams.player_key = player_scope.player_key
GROUP BY player_scope.player_key, player_teams.teams
ORDER BY label;
