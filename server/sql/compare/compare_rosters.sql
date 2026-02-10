{{rosterCtes}},
filtered_base AS (
  SELECT * FROM base fb WHERE 1=1 {{filterClauses}}
),
roster_scope AS (
  SELECT fb.*, sr.roster_id
  FROM filtered_base fb
  JOIN series_roster sr
    ON fb.series_id = sr.series_id
   AND fb.team = sr.team
  WHERE sr.roster_id = ANY({{idsParam}})
)
SELECT
  roster_scope.roster_id AS id,
  roster_names.roster_name AS label,
  COUNT(*) AS games,
  {{metricSelect}}
FROM roster_scope
LEFT JOIN roster_names ON roster_names.roster_id = roster_scope.roster_id
GROUP BY roster_scope.roster_id, roster_names.roster_name
ORDER BY roster_names.roster_name;
