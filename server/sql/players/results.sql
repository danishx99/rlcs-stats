-- Per-event tournament results for a player
-- Returns placement + series detail for each event, grouped by season
WITH stats_base AS (
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
    AND series_id IS NOT NULL
),
available_seasons AS (
  SELECT DISTINCT "Season" AS season
  FROM player_stats
  ORDER BY season DESC
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
series_winners AS (
  SELECT
    *,
    wins >= CEIL(best_of / 2.0) AS won_series
  FROM series_summary
),
opponent_summary AS (
  SELECT
    s.series_id,
    TRIM(s."Team") AS opp_team,
    COUNT(DISTINCT CASE WHEN s."Victory" THEN s."Game Number" END) AS opp_wins
  FROM stats_base s
  JOIN series_summary ss ON s.series_id = ss.series_id
  WHERE TRIM(s."Team") <> ss.team
  GROUP BY s.series_id, TRIM(s."Team")
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
event_classified AS (
  SELECT
    etl.*,
    (etl.round_depth = 100 AND etl.won_deepest) AS is_champion,
    (NOT (etl.round_depth = 100 AND etl.won_deepest) AND NOT etl.won_deepest) AS is_eliminated
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
    epb.team,
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
event_placement AS (
  SELECT
    pet.season,
    pet.split,
    pet.event,
    CASE
      WHEN etp.placement_end IS NOT NULL AND etp.placement_end < 999
      THEN CONCAT('Top ', etp.placement_end::text)
      ELSE NULL
    END AS placement
  FROM player_event_team pet
  LEFT JOIN event_team_placements etp
    ON etp.season IS NOT DISTINCT FROM pet.season
   AND etp.split IS NOT DISTINCT FROM pet.split
   AND etp.event IS NOT DISTINCT FROM pet.event
   AND etp.team_norm = UPPER(TRIM(pet.team))
),
series_detail AS (
  SELECT
    sw.series_id,
    sw.season,
    sw.split,
    sw.event,
    sw.stage,
    sw.round,
    sw.team,
    sw.best_of,
    sw.wins AS player_wins,
    sw.won_series,
    sw.match_date,
    os.opp_team AS opponent,
    COALESCE(os.opp_wins, 0) AS opponent_wins,
    ROW_NUMBER() OVER (
      PARTITION BY sw.season, sw.split, sw.event
      ORDER BY
        CASE
          WHEN UPPER(TRIM(sw.round)) LIKE 'GF%' THEN 100
          WHEN UPPER(TRIM(sw.round)) = 'UF' THEN 90
          WHEN UPPER(TRIM(sw.round)) = 'LF' THEN 90
          WHEN UPPER(TRIM(sw.round)) = 'SF' THEN 80
          WHEN UPPER(TRIM(sw.round)) = 'USF' THEN 80
          WHEN UPPER(TRIM(sw.round)) = 'LSF' THEN 80
          WHEN UPPER(TRIM(sw.round)) = 'QF' THEN 70
          WHEN UPPER(TRIM(sw.round)) = 'UQF' THEN 70
          WHEN UPPER(TRIM(sw.round)) = 'LQF' THEN 70
          WHEN UPPER(TRIM(sw.round)) = 'LR3' THEN 60
          WHEN UPPER(TRIM(sw.round)) = 'LR2' THEN 50
          WHEN UPPER(TRIM(sw.round)) = 'LR1' THEN 40
          WHEN UPPER(TRIM(sw.round)) = 'UR1' THEN 40
          WHEN UPPER(TRIM(sw.round)) = 'R1' THEN 40
          WHEN UPPER(TRIM(sw.round)) = 'SWISS 5' THEN 30
          WHEN UPPER(TRIM(sw.round)) = 'SWISS 4' THEN 28
          WHEN UPPER(TRIM(sw.round)) = 'SWISS 3' THEN 26
          WHEN UPPER(TRIM(sw.round)) = 'SWISS 2' THEN 24
          WHEN UPPER(TRIM(sw.round)) = 'SWISS 1' THEN 22
          WHEN UPPER(TRIM(sw.round)) = 'GROUPS' THEN 12
          ELSE 0
        END DESC,
        sw.match_date DESC NULLS LAST,
        sw.series_id DESC
    ) AS rn
  FROM series_winners sw
  LEFT JOIN opponent_summary os ON sw.series_id = os.series_id
)
SELECT
  ep.season,
  ep.split,
  ep.event,
  ep.placement,
  (
    SELECT JSON_AGG(sub ORDER BY sub.date ASC NULLS LAST)
    FROM (
      SELECT
        sd.series_id,
        sd.round,
        sd.stage,
        sd.opponent,
        sd.player_wins,
        sd.opponent_wins,
        sd.best_of,
        sd.won_series,
        sd.match_date AS date
      FROM series_detail sd
      WHERE sd.season IS NOT DISTINCT FROM ep.season
        AND sd.split IS NOT DISTINCT FROM ep.split
        AND sd.event IS NOT DISTINCT FROM ep.event
        AND sd.rn = 1
    ) sub
  ) AS series,
  (SELECT JSON_AGG(a.season) FROM available_seasons a) AS available_seasons
FROM event_placement ep
LEFT JOIN (
  SELECT season, split, event, MAX(match_date) AS latest_date
  FROM series_summary
  GROUP BY season, split, event
) ed ON ep.season IS NOT DISTINCT FROM ed.season
   AND ep.split IS NOT DISTINCT FROM ed.split
   AND ep.event IS NOT DISTINCT FROM ed.event
ORDER BY ed.latest_date DESC NULLS LAST;
