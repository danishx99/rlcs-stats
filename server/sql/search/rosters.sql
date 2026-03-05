WITH roster_match AS (
  SELECT
    roster_id,
    team,
    COUNT(*) AS series_count
  FROM series_roster
  WHERE team ILIKE {{likeParam}}
  GROUP BY roster_id, team
),
starter_profiles AS (
  SELECT
    rm.roster_id,
    starter_id,
    COALESCE(MIN(p."Primary Handle"), starter_id) AS handle
  FROM roster_match rm
  CROSS JOIN LATERAL unnest(
    (SELECT sr.starters FROM series_roster sr
     WHERE sr.roster_id = rm.roster_id LIMIT 1)
  ) AS starter_id
  LEFT JOIN players p ON p."Unique ID" = starter_id
  GROUP BY rm.roster_id, starter_id
)
SELECT DISTINCT ON (roster_id)
  roster_id AS id,
  team AS label,
  (SELECT json_agg(handle ORDER BY handle)
   FROM starter_profiles sp
   WHERE sp.roster_id = roster_match.roster_id) AS starters,
  (SELECT tp."Logo Link" FROM team_profiles tp
   WHERE UPPER(tp."Team Name") = UPPER(roster_match.team)
   LIMIT 1) AS logo_url
FROM roster_match
ORDER BY roster_id, series_count DESC, team
LIMIT {{limitParam}};
