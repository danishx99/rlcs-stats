-- Profile query that works even when player has no stats
-- First get player info from players table, then optionally join stats
WITH player_base AS (
  SELECT
    {{playerIdParam}} AS player_key,
    p."Primary Handle" AS handle,
    p."All Aliases" AS aliases,
    p."Real Name" AS real_name,
    p."Country" AS country,
    p."Photo URL" AS photo_url,
    p."Twitch" AS twitch,
    p."TikTok" AS tiktok,
    p."Date of Birth" AS date_of_birth
  FROM players p
  WHERE p."Player ID" = {{playerIdParam}}
),
player_exists AS (
  SELECT 1 WHERE EXISTS (SELECT 1 FROM player_base)
),
stats_base AS (
  SELECT
    s.*,
    {{playerKeyExpr}} AS player_key,
    {{seriesIdExpr}} AS series_id
  FROM stats s
  {{where}}
),
player_stats AS (
  SELECT *
  FROM stats_base
  WHERE player_key = {{playerIdParam}}
),
first_appearance AS (
  SELECT
    "Season" AS debut_season,
    "Split" AS debut_split,
    "Regional" AS debut_event
  FROM player_stats
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
  FROM player_stats
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
),
stats_summary AS (
  SELECT
    (SELECT debut_season FROM first_appearance) AS debut_season,
    (SELECT debut_split FROM first_appearance) AS debut_split,
    (SELECT debut_event FROM first_appearance) AS debut_event,
    (SELECT placement FROM best_result) AS best_result,
    (SELECT ARRAY_AGG(sub.team ORDER BY sub.latest_date DESC NULLS LAST) FROM (
      SELECT "Team" AS team, MAX("Date") AS latest_date
      FROM player_stats
      GROUP BY "Team"
    ) sub) AS teams,
    COUNT(*) AS games,
    COUNT(DISTINCT series_id) AS series_played,
    SUM(player_stats."Goals_All Zones") AS goals_total,
    AVG(player_stats."Goals_All Zones") AS goals_avg,
    SUM(player_stats."Assists_All Zones") AS assists_total,
    AVG(player_stats."Assists_All Zones") AS assists_avg,
    SUM(player_stats."Saves_All Zones") AS saves_total,
    AVG(player_stats."Saves_All Zones") AS saves_avg,
    SUM(player_stats."Kills_All Zones") AS demos_total,
    AVG(player_stats."Kills_All Zones") AS demos_avg
  FROM player_stats
)
SELECT
  {{playerIdParam}} AS player_id,
  COALESCE(pb.handle, MIN(ps."Player Name")) AS handle,
  MIN(ps."Player Name") AS player_name,
  NULLIF(TRIM(pb.aliases), '') AS aliases,
  NULLIF(TRIM(pb.real_name), '') AS real_name,
  NULLIF(TRIM(pb.country), '') AS country,
  NULLIF(TRIM(pb.photo_url), '') AS photo_url,
  NULLIF(TRIM(pb.twitch), '') AS twitch,
  NULLIF(TRIM(pb.tiktok), '') AS tiktok,
  pb.date_of_birth AS date_of_birth,
  ss.debut_season,
  ss.debut_split,
  ss.debut_event,
  ss.best_result,
  ss.teams,
  COALESCE(ss.games, 0) AS games,
  COALESCE(ss.series_played, 0) AS series_played,
  COALESCE(ss.goals_total, 0) AS goals_total,
  COALESCE(ss.goals_avg, 0) AS goals_avg,
  COALESCE(ss.assists_total, 0) AS assists_total,
  COALESCE(ss.assists_avg, 0) AS assists_avg,
  COALESCE(ss.saves_total, 0) AS saves_total,
  COALESCE(ss.saves_avg, 0) AS saves_avg,
  COALESCE(ss.demos_total, 0) AS demos_total,
  COALESCE(ss.demos_avg, 0) AS demos_avg,
  CASE WHEN EXISTS (SELECT 1 FROM player_exists) THEN 1 ELSE 0 END AS player_found
FROM player_base pb
FULL OUTER JOIN player_stats ps ON pb.player_key = ps.player_key
LEFT JOIN stats_summary ss ON true
GROUP BY 
  pb.handle, pb.aliases, pb.real_name, pb.country, pb.photo_url, 
  pb.twitch, pb.tiktok, pb.date_of_birth,
  ss.debut_season, ss.debut_split, ss.debut_event, ss.best_result, ss.teams,
  ss.games, ss.series_played, ss.goals_total, ss.goals_avg, 
  ss.assists_total, ss.assists_avg, ss.saves_total, ss.saves_avg, 
  ss.demos_total, ss.demos_avg;
