WITH base AS (
  SELECT s.*, TRIM(s."Team") AS team_key
  FROM stats s
  {{where}}
),
team_scope AS (
  SELECT * FROM base
)
SELECT
  team_scope.team_key AS id,
  team_scope.team_key AS label,
  {{primaryValueExpr}} AS value,
  {{avgValueExpr}} AS avg_value,
  {{totalValueExpr}} AS total_value
FROM team_scope
WHERE team_scope.team_key IS NOT NULL AND team_scope.team_key != ''
GROUP BY team_scope.team_key
{{havingClause}}
ORDER BY value {{sortDir}} NULLS LAST
LIMIT {{limitParam}};
