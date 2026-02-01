{{rosterCtes}},
roster_scope AS (
  SELECT b.*, sr.roster_id
  FROM base b
  JOIN series_roster sr
    ON b.series_id = sr.series_id
   AND b.team = sr.team
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
