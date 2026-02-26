WITH team_profiles_norm AS (
  SELECT
    UPPER(TRIM(tp."Team Name")) AS team_norm,
    MIN(tp."Team Name") AS org_name,
    MIN(tp."Logo Link") AS logo_url
  FROM team_profiles tp
  WHERE tp."Team Name" IS NOT NULL
    AND TRIM(tp."Team Name") <> ''
  GROUP BY UPPER(TRIM(tp."Team Name"))
),
series_dates AS (
  SELECT
    s.series_id,
    UPPER(TRIM(s."Team")) AS team_norm,
    MAX(s."Date") AS latest_date
  FROM stats s
  WHERE s.series_id IS NOT NULL
    AND s."Team" IS NOT NULL
    AND TRIM(s."Team") <> ''
  GROUP BY s.series_id, UPPER(TRIM(s."Team"))
),
grouped AS (
  SELECT
    sr.series_id,
    TRIM(sr.team) AS team_label,
    UPPER(TRIM(sr.team)) AS team_norm,
    sr.roster_id,
    sr.starters,
    sd.latest_date,
    tpn.org_name,
    tpn.logo_url,
    CASE
      WHEN tpn.org_name IS NOT NULL THEN 'org:' || tpn.team_norm
      ELSE 'roster:' || sr.roster_id
    END AS team_group_id,
    COALESCE(tpn.org_name, TRIM(sr.team)) AS display_name
  FROM series_roster sr
  LEFT JOIN series_dates sd
    ON sd.series_id = sr.series_id
   AND sd.team_norm = UPPER(TRIM(sr.team))
  LEFT JOIN team_profiles_norm tpn
    ON tpn.team_norm = UPPER(TRIM(sr.team))
),
matching_groups AS (
  SELECT DISTINCT g.team_group_id
  FROM grouped g
  WHERE g.display_name ILIKE $1
     OR g.team_label ILIKE $1
),
ranked AS (
  SELECT
    g.*,
    ROW_NUMBER() OVER (
      PARTITION BY g.team_group_id
      ORDER BY g.latest_date DESC NULLS LAST, g.roster_id, g.team_label
    ) AS rn
  FROM grouped g
  JOIN matching_groups mg ON mg.team_group_id = g.team_group_id
),
latest_roster AS (
  SELECT *
  FROM ranked
  WHERE rn = 1
),
starter_profiles AS (
  SELECT
    lr.team_group_id,
    starter_id,
    COALESCE(MIN(p."Primary Handle"), MIN(s."Player Name")) AS handle
  FROM latest_roster lr
  CROSS JOIN LATERAL unnest(lr.starters) AS starter_id
  LEFT JOIN players p ON p."Unique ID" = starter_id
  LEFT JOIN stats s ON NULLIF(TRIM(s."Unique ID"), '') = starter_id
  GROUP BY lr.team_group_id, starter_id
)
SELECT
  lr.team_group_id AS id,
  lr.display_name AS label,
  (SELECT json_agg(sp.handle ORDER BY sp.handle)
   FROM starter_profiles sp
   WHERE sp.team_group_id = lr.team_group_id) AS starters,
  lr.logo_url
FROM latest_roster lr
ORDER BY lr.latest_date DESC NULLS LAST, lr.display_name
LIMIT $2;
