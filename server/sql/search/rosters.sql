{{rosterCtes}},
roster_match AS (
  SELECT
    roster_id,
    team,
    COUNT(*) AS series_count
  FROM series_roster
  WHERE team ILIKE $1
  GROUP BY roster_id, team
),
roster_starters AS (
  SELECT roster_id, starters
  FROM series_roster
),
starter_profiles AS (
  SELECT
    rs.roster_id,
    starter_id,
    COALESCE(MIN(p."Primary Handle"), MIN(b."Player Name")) AS handle
  FROM roster_starters rs
  CROSS JOIN LATERAL unnest(rs.starters) AS starter_id
  LEFT JOIN base b ON b.player_key = starter_id
  LEFT JOIN players p ON p."Player ID" = starter_id
  GROUP BY rs.roster_id, starter_id
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
LIMIT $2;
