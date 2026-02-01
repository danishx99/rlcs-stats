WITH base AS (
  SELECT
    s.*,
    {{playerKeyExpr}} AS player_key,
    {{seriesIdExpr}} AS series_id
  FROM stats s
  {{where}}
),
player_scope AS (
  SELECT *
  FROM base
  WHERE player_key = {{playerIdParam}}
),
first_appearance AS (
  SELECT
    "Season" AS debut_season,
    "Split" AS debut_split,
    "Regional" AS debut_event
  FROM player_scope
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
  FROM player_scope
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
  {{playerIdParam}} AS player_id,
  COALESCE(MIN(p."Primary Handle"), MIN(player_scope."Player Name")) AS handle,
  MIN(player_scope."Player Name") AS player_name,
  MIN(NULLIF(TRIM(p."All Aliases"), '')) AS aliases,
  MIN(NULLIF(TRIM(p."Real Name"), '')) AS real_name,
  MIN(NULLIF(TRIM(p."Country"), '')) AS country,
  MIN(NULLIF(TRIM(p."Photo URL"), '')) AS photo_url,
  MIN(NULLIF(TRIM(p."Twitch"), '')) AS twitch,
  MIN(NULLIF(TRIM(p."TikTok"), '')) AS tiktok,
  MIN(NULLIF(TRIM(p."Birthdate"), '')) AS date_of_birth,
  (SELECT debut_season FROM first_appearance) AS debut_season,
  (SELECT debut_split FROM first_appearance) AS debut_split,
  (SELECT debut_event FROM first_appearance) AS debut_event,
  (SELECT placement FROM best_result) AS best_result,
  ARRAY_AGG(DISTINCT player_scope."Team") AS teams,
  COUNT(*) AS games,
  COUNT(DISTINCT player_scope.series_id) AS series_played,
  SUM(player_scope."Goals_All Zones") AS goals_total,
  AVG(player_scope."Goals_All Zones") AS goals_avg,
  SUM(player_scope."Assists_All Zones") AS assists_total,
  AVG(player_scope."Assists_All Zones") AS assists_avg,
  SUM(player_scope."Saves_All Zones") AS saves_total,
  AVG(player_scope."Saves_All Zones") AS saves_avg,
  SUM(player_scope."Kills_All Zones") AS demos_total,
  AVG(player_scope."Kills_All Zones") AS demos_avg
FROM player_scope
LEFT JOIN players p ON p."Player ID" = player_scope.player_key
GROUP BY player_scope.player_key;
