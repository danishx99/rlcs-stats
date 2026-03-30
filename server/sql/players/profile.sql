-- Profile query that works even when player has no stats
-- First get player info from players table, then optionally join stats
WITH player_base AS (
  SELECT
    {{playerIdParam}} AS player_key,
    p."Primary Handle" AS handle,
    p.aka AS aliases,
    p."Real Name" AS real_name,
    p."Country" AS country,
    p."Photo URL" AS photo_url,
    p."Twitch" AS twitch,
    p."TikTok" AS tiktok,
    p."Date of Birth" AS date_of_birth
  FROM players p
  WHERE p."Unique ID" = {{playerIdParam}}
),
player_exists AS (
  SELECT 1 WHERE EXISTS (SELECT 1 FROM player_base)
),
stats_base AS (
  SELECT
    s.*,
    {{playerKeyExpr}} AS player_key
  FROM stats s
  {{where}}
),
player_stats AS (
  SELECT *
  FROM stats_base
  WHERE player_key = {{playerIdParam}}
),
player_stats_3s AS (
  SELECT *
  FROM player_stats
  WHERE LOWER(TRIM("mode")) = '3s'
    AND "Team" IS NOT NULL
    AND TRIM("Team") <> ''
),
stats_base_3s AS (
  SELECT *
  FROM stats_base
  WHERE LOWER(TRIM("mode")) = '3s'
    AND "Team" IS NOT NULL
    AND TRIM("Team") <> ''
),
first_appearance AS (
  SELECT
    "Season" AS debut_season,
    "Split" AS debut_split,
    "Event" AS debut_event
  FROM player_stats
  ORDER BY "Date" ASC NULLS LAST, "Season" ASC, "Split" ASC, "Event" ASC
  LIMIT 1
),
series_summary AS (
  SELECT
    series_id,
    "Season" AS season,
    "Split" AS split,
    "Event" AS event,
    "Stage" AS stage,
    MIN("Round") AS round,
    "Team" AS team,
    MAX("Best of ") AS best_of,
    SUM(CASE WHEN "Victory" THEN 1 ELSE 0 END) AS wins,
    MIN("Date") AS match_date
  FROM player_stats
  GROUP BY series_id, "Season", "Split", "Event", "Stage", "Team"
),
player_events AS (
  SELECT DISTINCT
    TRIM(season) AS season,
    TRIM(split) AS split,
    TRIM(event) AS event
  FROM series_summary
),
player_event_team AS (
  SELECT
    season,
    split,
    event,
    (ARRAY_AGG(team ORDER BY latest_date DESC NULLS LAST, team))[1] AS team
  FROM (
    SELECT
      season,
      split,
      event,
      TRIM(team) AS team,
      MAX(match_date) AS latest_date
    FROM series_summary
    WHERE team IS NOT NULL
      AND TRIM(team) <> ''
    GROUP BY season, split, event, TRIM(team)
  ) t
  GROUP BY season, split, event
),
event_base_scope AS (
  SELECT s.*
  FROM stats_base s
  JOIN player_events pe
    ON TRIM(s."Season") IS NOT DISTINCT FROM pe.season
   AND TRIM(s."Split") IS NOT DISTINCT FROM pe.split
   AND TRIM(s."Event") IS NOT DISTINCT FROM pe.event
  WHERE s."Team" IS NOT NULL
    AND TRIM(s."Team") <> ''
),
event_has_playoffs AS (
  SELECT
    TRIM("Season") AS season,
    TRIM("Split") AS split,
    TRIM("Event") AS event,
    BOOL_OR(LOWER(TRIM("Stage")) LIKE '%playoff%') AS has_playoffs
  FROM event_base_scope
  GROUP BY TRIM("Season"), TRIM("Split"), TRIM("Event")
),
event_scoped AS (
  SELECT ebs.*
  FROM event_base_scope ebs
  JOIN event_has_playoffs ehp
    ON TRIM(ebs."Season") IS NOT DISTINCT FROM ehp.season
   AND TRIM(ebs."Split") IS NOT DISTINCT FROM ehp.split
   AND TRIM(ebs."Event") IS NOT DISTINCT FROM ehp.event
  WHERE (ehp.has_playoffs AND LOWER(TRIM(ebs."Stage")) LIKE '%playoff%')
     OR (NOT ehp.has_playoffs)
),
event_team_rounds AS (
  SELECT
    TRIM("Season") AS season,
    TRIM("Split") AS split,
    TRIM("Event") AS event,
    UPPER(TRIM("Team")) AS team_norm,
    MIN(TRIM("Team")) AS team,
    UPPER(TRIM("Round")) AS rnd,
    MAX("Date") AS round_date,
    CASE UPPER(TRIM("Round"))
      WHEN 'GF'      THEN 100
      WHEN 'GF 1'    THEN 100
      WHEN 'GF1'     THEN 100
      WHEN 'GF 2'    THEN 100
      WHEN 'GF2'     THEN 100
      WHEN 'UF'      THEN 90
      WHEN 'LF'      THEN 90
      WHEN 'SF'      THEN 80
      WHEN 'USF'     THEN 80
      WHEN 'LSF'     THEN 80
      WHEN 'QF'      THEN 70
      WHEN 'UQF'     THEN 70
      WHEN 'LQF'     THEN 70
      WHEN 'LR3'     THEN 60
      WHEN 'LR2'     THEN 50
      WHEN 'LR1'     THEN 40
      WHEN 'UR1'     THEN 40
      WHEN 'R1'      THEN 40
      WHEN 'SWISS 5' THEN 30
      WHEN 'SWISS 4' THEN 28
      WHEN 'SWISS 3' THEN 26
      WHEN 'SWISS 2' THEN 24
      WHEN 'SWISS 1' THEN 22
      WHEN 'GROUPS'  THEN 12
      ELSE 0
    END AS depth,
    (
      SUM(CASE WHEN "Victory" = true THEN 1 ELSE 0 END)
      >
      SUM(CASE WHEN COALESCE("Victory", false) = false THEN 1 ELSE 0 END)
    ) AS won_round
  FROM event_scoped
  WHERE "Round" IS NOT NULL
    AND TRIM("Round") <> ''
  GROUP BY TRIM("Season"), TRIM("Split"), TRIM("Event"), UPPER(TRIM("Team")), UPPER(TRIM("Round"))
),
event_team_latest AS (
  SELECT DISTINCT ON (season, split, event, team_norm)
    season,
    split,
    event,
    team_norm,
    team,
    rnd AS deep_round,
    depth AS round_depth,
    round_date,
    won_round AS won_deepest
  FROM event_team_rounds
  ORDER BY season, split, event, team_norm, depth DESC, round_date DESC NULLS LAST
),
event_upper_only_losses AS (
  SELECT season, split, event, team_norm
  FROM event_team_rounds
  WHERE NOT won_round AND rnd LIKE 'U%'
  EXCEPT
  SELECT season, split, event, team_norm
  FROM event_team_rounds
  WHERE NOT won_round AND rnd NOT LIKE 'U%'
),
event_classified AS (
  SELECT
    etl.*,
    (etl.round_depth = 100 AND etl.won_deepest) AS is_champion,
    (NOT (etl.round_depth = 100 AND etl.won_deepest)
      AND NOT etl.won_deepest
      AND NOT EXISTS (
        SELECT 1 FROM event_upper_only_losses eul
        WHERE eul.season IS NOT DISTINCT FROM etl.season
          AND eul.split IS NOT DISTINCT FROM etl.split
          AND eul.event IS NOT DISTINCT FROM etl.event
          AND eul.team_norm = etl.team_norm
      )
    ) AS is_eliminated
  FROM event_team_latest etl
),
event_placement_basis AS (
  SELECT
    ec.*,
    CASE
      WHEN ec.is_champion THEN NULL::int
      WHEN ec.is_eliminated THEN ec.round_depth
      ELSE COALESCE(
        (
          SELECT MIN(e.round_depth)
          FROM (
            SELECT DISTINCT season, split, event, round_depth
            FROM event_classified
            WHERE is_eliminated
          ) e
          WHERE e.season IS NOT DISTINCT FROM ec.season
            AND e.split IS NOT DISTINCT FROM ec.split
            AND e.event IS NOT DISTINCT FROM ec.event
            AND e.round_depth > ec.round_depth
        ),
        ec.round_depth
      )
    END AS effective_depth
  FROM event_classified ec
),
event_elim_groups AS (
  SELECT
    season,
    split,
    event,
    effective_depth AS round_depth,
    COUNT(*) AS team_count
  FROM event_placement_basis
  WHERE NOT is_champion
  GROUP BY season, split, event, effective_depth
),
event_elim_ranges AS (
  SELECT
    eeg.season,
    eeg.split,
    eeg.event,
    eeg.round_depth,
    eeg.team_count,
    COALESCE(
      SUM(eeg.team_count) OVER (
        PARTITION BY eeg.season, eeg.split, eeg.event
        ORDER BY eeg.round_depth DESC
        ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
      ),
      0
    ) + 2 AS placement_start
  FROM event_elim_groups eeg
),
event_team_placements AS (
  SELECT
    epb.season,
    epb.split,
    epb.event,
    epb.team_norm,
    CASE
      WHEN epb.is_champion THEN 1
      WHEN epb.effective_depth IS NOT NULL THEN eer.placement_start
      ELSE 999
    END AS placement_start,
    CASE
      WHEN epb.is_champion THEN 1
      WHEN epb.effective_depth IS NOT NULL THEN eer.placement_start + eer.team_count - 1
      ELSE 999
    END AS placement_end
  FROM event_placement_basis epb
  LEFT JOIN event_elim_ranges eer
    ON eer.season IS NOT DISTINCT FROM epb.season
   AND eer.split IS NOT DISTINCT FROM epb.split
   AND eer.event IS NOT DISTINCT FROM epb.event
   AND eer.round_depth = epb.effective_depth
),
player_event_placements AS (
  SELECT
    pet.season,
    pet.split,
    pet.event,
    etp.placement_end
  FROM player_event_team pet
  LEFT JOIN event_team_placements etp
    ON etp.season IS NOT DISTINCT FROM pet.season
   AND etp.split IS NOT DISTINCT FROM pet.split
   AND etp.event IS NOT DISTINCT FROM pet.event
   AND etp.team_norm = UPPER(TRIM(pet.team))
),
best_result AS (
  SELECT
    CASE
      WHEN MIN(placement_end) FILTER (WHERE placement_end < 999) IS NULL THEN NULL
      ELSE CONCAT('Top ', MIN(placement_end) FILTER (WHERE placement_end < 999)::text)
    END AS placement
  FROM player_event_placements
),
stats_summary AS (
  SELECT
    (SELECT debut_season FROM first_appearance) AS debut_season,
    (SELECT debut_split FROM first_appearance) AS debut_split,
    (SELECT debut_event FROM first_appearance) AS debut_event,
    (SELECT placement FROM best_result) AS best_result,
    (SELECT ARRAY_AGG(sub.team ORDER BY sub.latest_date DESC NULLS LAST) FROM (
      SELECT "Team" AS team, MAX("Date") AS latest_date
      FROM player_stats_3s
      GROUP BY "Team"
    ) sub) AS teams,
    COUNT(*) AS games,
    SUM(CASE WHEN player_stats."Victory" = true THEN 1 ELSE 0 END) AS games_won,
    SUM(CASE WHEN COALESCE(player_stats."Victory", false) = false THEN 1 ELSE 0 END) AS games_lost,
    COUNT(DISTINCT series_id) AS series_played,
    (SELECT SUM("Goals_All Zones") FROM player_stats_3s) AS goals_total,
    (SELECT AVG("Goals_All Zones") FROM player_stats_3s) AS goals_avg,
    (SELECT SUM("Assists_All Zones") FROM player_stats_3s) AS assists_total,
    (SELECT AVG("Assists_All Zones") FROM player_stats_3s) AS assists_avg,
    (SELECT SUM("Saves_All Zones") FROM player_stats_3s) AS saves_total,
    (SELECT AVG("Saves_All Zones") FROM player_stats_3s) AS saves_avg,
    (SELECT SUM("Kills_All Zones") FROM player_stats_3s) AS demos_total,
    (SELECT AVG("Kills_All Zones") FROM player_stats_3s) AS demos_avg
  FROM player_stats
),
player_rankings AS (
  SELECT
    player_key,
    RANK() OVER (ORDER BY AVG("Goals_All Zones") DESC NULLS LAST) AS goals_rank_avg,
    RANK() OVER (ORDER BY SUM("Goals_All Zones") DESC NULLS LAST) AS goals_rank_total,
    RANK() OVER (ORDER BY AVG("Assists_All Zones") DESC NULLS LAST) AS assists_rank_avg,
    RANK() OVER (ORDER BY SUM("Assists_All Zones") DESC NULLS LAST) AS assists_rank_total,
    RANK() OVER (ORDER BY AVG("Saves_All Zones") DESC NULLS LAST) AS saves_rank_avg,
    RANK() OVER (ORDER BY SUM("Saves_All Zones") DESC NULLS LAST) AS saves_rank_total,
    RANK() OVER (ORDER BY AVG("Kills_All Zones") DESC NULLS LAST) AS demos_rank_avg,
    RANK() OVER (ORDER BY SUM("Kills_All Zones") DESC NULLS LAST) AS demos_rank_total
  FROM stats_base_3s
  WHERE player_key IS NOT NULL
  GROUP BY player_key
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
  COALESCE(ss.games_won, 0) AS games_won,
  COALESCE(ss.games_lost, 0) AS games_lost,
  COALESCE(ss.series_played, 0) AS series_played,
  COALESCE(ss.goals_total, 0) AS goals_total,
  COALESCE(ss.goals_avg, 0) AS goals_avg,
  COALESCE(ss.assists_total, 0) AS assists_total,
  COALESCE(ss.assists_avg, 0) AS assists_avg,
  COALESCE(ss.saves_total, 0) AS saves_total,
  COALESCE(ss.saves_avg, 0) AS saves_avg,
  COALESCE(ss.demos_total, 0) AS demos_total,
  COALESCE(ss.demos_avg, 0) AS demos_avg,
  pr.goals_rank_avg,
  pr.goals_rank_total,
  pr.assists_rank_avg,
  pr.assists_rank_total,
  pr.saves_rank_avg,
  pr.saves_rank_total,
  pr.demos_rank_avg,
  pr.demos_rank_total,
  CASE
    WHEN EXISTS (SELECT 1 FROM player_exists) OR EXISTS (SELECT 1 FROM player_stats) THEN 1
    ELSE 0
  END AS player_found
FROM player_base pb
FULL OUTER JOIN player_stats ps ON pb.player_key = ps.player_key
LEFT JOIN stats_summary ss ON true
LEFT JOIN player_rankings pr ON pr.player_key = {{playerIdParam}}
GROUP BY 
  pb.handle, pb.aliases, pb.real_name, pb.country, pb.photo_url, 
  pb.twitch, pb.tiktok, pb.date_of_birth,
  ss.debut_season, ss.debut_split, ss.debut_event, ss.best_result, ss.teams,
  ss.games, ss.games_won, ss.games_lost, ss.series_played, ss.goals_total, ss.goals_avg, 
  ss.assists_total, ss.assists_avg, ss.saves_total, ss.saves_avg, 
  ss.demos_total, ss.demos_avg,
  pr.goals_rank_avg, pr.goals_rank_total,
  pr.assists_rank_avg, pr.assists_rank_total,
  pr.saves_rank_avg, pr.saves_rank_total,
  pr.demos_rank_avg, pr.demos_rank_total;
