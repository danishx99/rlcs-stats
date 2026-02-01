{{rosterCtes}},
roster_scope AS (
  SELECT b.*, sr.roster_id
  FROM base b
  JOIN series_roster sr
    ON b.series_id = sr.series_id
   AND b.team = sr.team
  WHERE sr.roster_id = {{rosterIdParam}}
),
roster_players AS (
  SELECT
    roster_id,
    player_key,
    COUNT(*) AS appearances
  FROM roster_scope
  WHERE player_key IS NOT NULL
  GROUP BY roster_id, player_key
),
ranked_players AS (
  SELECT
    roster_id,
    player_key,
    appearances,
    ROW_NUMBER() OVER (
      PARTITION BY roster_id
      ORDER BY appearances DESC, player_key
    ) AS rn
  FROM roster_players
),
roster_starters AS (
  SELECT roster_id, player_key AS starter_id
  FROM ranked_players
  WHERE rn <= 3
),
roster_alternates AS (
  SELECT roster_id, player_key AS alt_id, appearances
  FROM ranked_players
  WHERE rn > 3
),
starter_profiles AS (
  SELECT
    rs.roster_id,
    rs.starter_id,
    COALESCE(MIN(p."Primary Handle"), MIN(b."Player Name")) AS handle
  FROM roster_starters rs
  LEFT JOIN base b ON b.player_key = rs.starter_id
  LEFT JOIN players p ON p."Player ID" = rs.starter_id
  GROUP BY rs.roster_id, rs.starter_id
),
alternate_profiles AS (
  SELECT
    ra.roster_id,
    ra.alt_id,
    ra.appearances,
    COALESCE(MIN(p."Primary Handle"), MIN(b."Player Name")) AS handle
  FROM roster_alternates ra
  LEFT JOIN base b ON b.player_key = ra.alt_id
  LEFT JOIN players p ON p."Player ID" = ra.alt_id
  GROUP BY ra.roster_id, ra.alt_id, ra.appearances
),
first_appearance AS (
  SELECT
    "Season" AS debut_season,
    "Split" AS debut_split,
    "Regional" AS debut_event
  FROM roster_scope
  ORDER BY "Date" ASC NULLS LAST, "Season" ASC, "Split" ASC, "Regional" ASC
  LIMIT 1
),
series_summary AS (
  SELECT
    series_id,
    "Season" AS season,
    "Split" AS split,
    "Regional" AS regional,
    "Stage" AS stage,
    MIN("Round") AS round,
    "Team" AS team,
    MAX("Best of ") AS best_of,
    SUM(CASE WHEN "Victory" THEN 1 ELSE 0 END) AS wins
  FROM roster_scope
  GROUP BY series_id, "Season", "Split", "Regional", "Stage", "Team"
),
series_winners AS (
  SELECT
    *,
    wins >= CEIL(best_of / 2.0) AS won_series
  FROM series_summary
),
event_gf AS (
  SELECT
    season,
    split,
    regional,
    stage,
    MAX(
      CASE
        WHEN round ILIKE '%GF 2%' OR round ILIKE '%GF2%' THEN 2
        WHEN round ILIKE '%GF 1%' OR round ILIKE '%GF1%' THEN 1
        WHEN round ILIKE '%GF%' THEN 1
        ELSE 0
      END
    ) AS gf_tier
  FROM series_summary
  GROUP BY season, split, regional, stage
),
gf_champs AS (
  SELECT s.*
  FROM series_winners s
  JOIN event_gf e
    ON s.season IS NOT DISTINCT FROM e.season
   AND s.split IS NOT DISTINCT FROM e.split
   AND s.regional IS NOT DISTINCT FROM e.regional
   AND s.stage IS NOT DISTINCT FROM e.stage
  WHERE s.won_series = true
    AND (
      (e.gf_tier = 2 AND (s.round ILIKE '%GF 2%' OR s.round ILIKE '%GF2%'))
      OR (e.gf_tier <= 1 AND s.round ILIKE '%GF%')
    )
),
best_result AS (
  SELECT
    CASE
      WHEN EXISTS (SELECT 1 FROM gf_champs) THEN 'Top 1'
      WHEN EXISTS (SELECT 1 FROM series_summary WHERE round ILIKE '%GF%') THEN 'Top 2'
      WHEN EXISTS (SELECT 1 FROM series_summary WHERE round ILIKE '%SF%') THEN 'Top 4'
      WHEN EXISTS (SELECT 1 FROM series_summary WHERE round ILIKE '%QF%') THEN 'Top 8'
      WHEN EXISTS (SELECT 1 FROM series_summary WHERE round ILIKE '%R16%' OR round ILIKE '%16%') THEN 'Top 16'
      WHEN EXISTS (SELECT 1 FROM series_summary WHERE round ILIKE '%R32%' OR round ILIKE '%32%') THEN 'Top 32'
      WHEN EXISTS (SELECT 1 FROM series_summary WHERE stage ILIKE '%Playoff%') THEN 'Top 8'
      WHEN EXISTS (SELECT 1 FROM series_summary WHERE stage ILIKE '%Swiss%') THEN 'Top 16'
      ELSE NULL
    END AS placement
)
SELECT
  roster_starters.roster_id AS roster_id,
  roster_names.roster_name AS roster_name,
  (SELECT json_agg(json_build_object('id', starter_id, 'handle', handle) ORDER BY starter_id)
   FROM starter_profiles) AS starters,
  (SELECT json_agg(json_build_object('id', alt_id, 'handle', handle, 'appearances', appearances)
           ORDER BY appearances DESC, alt_id)
   FROM alternate_profiles) AS alternates,
  MIN(roster_scope."Date") AS debut_date,
  (SELECT placement FROM best_result) AS best_result,
  COUNT(*) AS games,
  COUNT(DISTINCT roster_scope.series_id) AS series_played,
  SUM(roster_scope."Goals_All Zones") AS goals_total,
  AVG(roster_scope."Goals_All Zones") AS goals_avg,
  SUM(roster_scope."Assists_All Zones") AS assists_total,
  AVG(roster_scope."Assists_All Zones") AS assists_avg,
  SUM(roster_scope."Saves_All Zones") AS saves_total,
  AVG(roster_scope."Saves_All Zones") AS saves_avg,
  SUM(roster_scope."Kills_All Zones") AS demos_total,
  AVG(roster_scope."Kills_All Zones") AS demos_avg
FROM roster_scope
JOIN roster_starters ON roster_starters.roster_id = {{rosterIdParam}}
LEFT JOIN roster_names ON roster_names.roster_id = roster_starters.roster_id
GROUP BY roster_starters.roster_id, roster_names.roster_name;
