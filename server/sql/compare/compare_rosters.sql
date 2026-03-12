WITH roster_scope AS (
  SELECT
    s.*,
    sr.roster_id
  FROM series_roster sr
  JOIN stats s
    ON s.series_id = sr.series_id
   AND s."Team" = sr.team
  WHERE sr.roster_id = ANY({{idsParam}})
    {{filterClauses}}
),
roster_counts AS (
  SELECT
    sr.roster_id,
    sr.team,
    COUNT(*) AS series_count
  FROM series_roster sr
  WHERE sr.roster_id = ANY({{idsParam}})
  GROUP BY sr.roster_id, sr.team
),
roster_names AS (
  SELECT DISTINCT ON (roster_id)
    roster_id,
    team AS roster_name
  FROM roster_counts
  ORDER BY roster_id, series_count DESC, team
)
SELECT
  roster_scope.roster_id AS id,
  roster_names.roster_name AS label,
  COUNT(DISTINCT (roster_scope.series_id, roster_scope."Game Number")) AS games,
  {{metricSelect}}
FROM roster_scope
LEFT JOIN roster_names ON roster_names.roster_id = roster_scope.roster_id
GROUP BY roster_scope.roster_id, roster_names.roster_name
ORDER BY roster_names.roster_name;
