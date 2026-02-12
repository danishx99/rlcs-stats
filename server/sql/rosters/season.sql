WITH params AS (
  SELECT
    CASE
      WHEN {{rosterIdParam}} LIKE 'org:%' OR {{rosterIdParam}} LIKE 'roster:%' THEN {{rosterIdParam}}
      ELSE 'roster:' || {{rosterIdParam}}
    END AS team_group_id
),
team_profiles_norm AS (
  SELECT
    UPPER(TRIM(tp."Team Name")) AS team_norm,
    MIN(tp."Team Name") AS org_name
  FROM team_profiles tp
  WHERE tp."Team Name" IS NOT NULL
    AND TRIM(tp."Team Name") <> ''
  GROUP BY UPPER(TRIM(tp."Team Name"))
),
base AS (
  SELECT
    s.*,
    TRIM(s."Team") AS team_label,
    UPPER(TRIM(s."Team")) AS team_norm,
    NULLIF(TRIM(s."Unique ID"), '') AS player_key
  FROM stats s
  {{where}}
),
series_meta AS (
  SELECT
    b.series_id,
    b.team_norm
  FROM base b
  WHERE b.series_id IS NOT NULL
    AND b.team_norm IS NOT NULL
  GROUP BY b.series_id, b.team_norm
),
grouped_series AS (
  SELECT
    sr.series_id,
    UPPER(TRIM(sr.team)) AS team_norm,
    sr.roster_id,
    CASE
      WHEN tpn.org_name IS NOT NULL THEN 'org:' || tpn.team_norm
      ELSE 'roster:' || sr.roster_id
    END AS team_group_id
  FROM series_roster sr
  JOIN series_meta sm
    ON sm.series_id = sr.series_id
   AND sm.team_norm = UPPER(TRIM(sr.team))
  LEFT JOIN team_profiles_norm tpn
    ON tpn.team_norm = UPPER(TRIM(sr.team))
),
group_scope AS (
  SELECT gs.*
  FROM grouped_series gs
  JOIN params p ON p.team_group_id = gs.team_group_id
),
team_scope AS (
  SELECT
    b.*,
    gs.roster_id
  FROM base b
  JOIN group_scope gs
    ON gs.series_id = b.series_id
   AND gs.team_norm = b.team_norm
)
SELECT
  team_scope."Season" AS season,
  COUNT(DISTINCT (team_scope.series_id, team_scope."Game")) AS games,
  COUNT(DISTINCT team_scope.series_id) AS series_played,
  {{goalsExpr}} AS goals,
  {{assistsExpr}} AS assists,
  {{savesExpr}} AS saves,
  {{demosExpr}} AS demos
FROM team_scope
GROUP BY team_scope."Season"
ORDER BY team_scope."Season";
