-- Per-event tournament results for a player
-- Returns placement + series detail for each event, grouped by season
WITH available_seasons AS (
  SELECT DISTINCT "Season" AS season
  FROM stats
  WHERE "Unique ID" = {{playerIdParam}}
    AND series_id IS NOT NULL
  ORDER BY season DESC
),
stats_base AS (
  SELECT s.*
  FROM stats s
  {{where}}
),
player_stats AS (
  SELECT *
  FROM stats_base
  WHERE "Unique ID" = {{playerIdParam}}
    AND series_id IS NOT NULL
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
player_event_participant AS (
  SELECT
    season,
    split,
    event,
    (ARRAY_AGG(participant_norm ORDER BY latest_date DESC NULLS LAST, participant_norm))[1] AS participant_norm,
    (ARRAY_AGG(team ORDER BY latest_date DESC NULLS LAST, team))[1] AS team
  FROM (
    SELECT
      TRIM("Season") AS season,
      TRIM("Split") AS split,
      TRIM("Event") AS event,
      CASE
        WHEN LOWER(TRIM("mode")) = '1s' AND COALESCE(TRIM("Unique ID"), '') <> '' THEN UPPER(TRIM("Unique ID"))
        ELSE UPPER(TRIM("Team"))
      END AS participant_norm,
      TRIM("Team") AS team,
      MAX("Date") AS latest_date
    FROM player_stats
    WHERE "Team" IS NOT NULL
      AND TRIM("Team") <> ''
    GROUP BY
      TRIM("Season"),
      TRIM("Split"),
      TRIM("Event"),
      CASE
        WHEN LOWER(TRIM("mode")) = '1s' AND COALESCE(TRIM("Unique ID"), '') <> '' THEN UPPER(TRIM("Unique ID"))
        ELSE UPPER(TRIM("Team"))
      END,
      TRIM("Team")
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
event_meta AS (
  SELECT
    TRIM("Season") AS season,
    TRIM("Split") AS split,
    TRIM("Event") AS event,
    MIN(LOWER(TRIM("mode"))) AS mode,
    MIN(LOWER(TRIM("scope"))) AS scope,
    MIN(LOWER(TRIM("tier"))) AS tier
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
    CASE
      WHEN LOWER(TRIM("mode")) = '1s' AND COALESCE(TRIM("Unique ID"), '') <> '' THEN UPPER(TRIM("Unique ID"))
      ELSE UPPER(TRIM("Team"))
    END AS participant_norm,
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
      WHEN '5'       THEN 30
      WHEN 'R5'      THEN 30
      WHEN 'ROUND 5' THEN 30
      WHEN 'SWISS 4' THEN 28
      WHEN '4'       THEN 28
      WHEN 'R4'      THEN 28
      WHEN 'ROUND 4' THEN 28
      WHEN 'SWISS 3' THEN 26
      WHEN '3'       THEN 26
      WHEN 'R3'      THEN 26
      WHEN 'ROUND 3' THEN 26
      WHEN 'SWISS 2' THEN 24
      WHEN '2'       THEN 24
      WHEN 'R2'      THEN 24
      WHEN 'ROUND 2' THEN 24
      WHEN 'SWISS 1' THEN 22
      WHEN '1'       THEN 22
      WHEN 'ROUND 1' THEN 22
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
  GROUP BY
    TRIM("Season"),
    TRIM("Split"),
    TRIM("Event"),
    CASE
      WHEN LOWER(TRIM("mode")) = '1s' AND COALESCE(TRIM("Unique ID"), '') <> '' THEN UPPER(TRIM("Unique ID"))
      ELSE UPPER(TRIM("Team"))
    END,
    UPPER(TRIM("Round"))
),
event_team_latest AS (
  SELECT DISTINCT ON (season, split, event, participant_norm)
    season,
    split,
    event,
    participant_norm,
    team,
    rnd AS deep_round,
    depth AS round_depth,
    round_date,
    won_round AS won_deepest
  FROM event_team_rounds
  ORDER BY season, split, event, participant_norm, depth DESC, round_date DESC NULLS LAST
),
event_upper_only_losses AS (
  SELECT season, split, event, participant_norm
  FROM event_team_rounds
  WHERE NOT won_round AND rnd LIKE 'U%'
  EXCEPT
  SELECT season, split, event, participant_norm
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
          AND eul.participant_norm = etl.participant_norm
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
    epb.participant_norm,
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
event_playoff_anchor AS (
  SELECT
    season,
    split,
    event,
    COALESCE(MAX(placement_end) FILTER (WHERE placement_end < 999), 0) AS placement_anchor
  FROM event_team_placements
  GROUP BY season, split, event
),
event_non_playoff_game_results AS (
  SELECT
    TRIM(ebs."Season") AS season,
    TRIM(ebs."Split") AS split,
    TRIM(ebs."Event") AS event,
    CASE
      WHEN LOWER(TRIM(ebs."mode")) = '1s' AND COALESCE(TRIM(ebs."Unique ID"), '') <> '' THEN UPPER(TRIM(ebs."Unique ID"))
      ELSE UPPER(TRIM(ebs."Team"))
    END AS participant_norm,
    MIN(TRIM(ebs."Team")) AS team,
    UPPER(TRIM(ebs."Round")) AS rnd,
    ebs.series_id,
    ebs."Game Number" AS game_number,
    MAX(ebs."Date") AS match_date,
    MAX(ebs."Best of ") AS best_of,
    BOOL_OR(ebs."Victory") AS game_won,
    CASE UPPER(TRIM(ebs."Round"))
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
      WHEN '5'       THEN 30
      WHEN 'R5'      THEN 30
      WHEN 'ROUND 5' THEN 30
      WHEN 'SWISS 4' THEN 28
      WHEN '4'       THEN 28
      WHEN 'R4'      THEN 28
      WHEN 'ROUND 4' THEN 28
      WHEN 'SWISS 3' THEN 26
      WHEN '3'       THEN 26
      WHEN 'R3'      THEN 26
      WHEN 'ROUND 3' THEN 26
      WHEN 'SWISS 2' THEN 24
      WHEN '2'       THEN 24
      WHEN 'R2'      THEN 24
      WHEN 'ROUND 2' THEN 24
      WHEN 'SWISS 1' THEN 22
      WHEN '1'       THEN 22
      WHEN 'ROUND 1' THEN 22
      WHEN 'GROUPS'  THEN 12
      ELSE 0
    END AS depth
  FROM event_base_scope ebs
  JOIN event_has_playoffs ehp
    ON TRIM(ebs."Season") IS NOT DISTINCT FROM ehp.season
   AND TRIM(ebs."Split") IS NOT DISTINCT FROM ehp.split
   AND TRIM(ebs."Event") IS NOT DISTINCT FROM ehp.event
   AND ehp.has_playoffs
  LEFT JOIN event_team_placements etp
    ON etp.season IS NOT DISTINCT FROM TRIM(ebs."Season")
   AND etp.split IS NOT DISTINCT FROM TRIM(ebs."Split")
   AND etp.event IS NOT DISTINCT FROM TRIM(ebs."Event")
   AND etp.participant_norm = CASE
     WHEN LOWER(TRIM(ebs."mode")) = '1s' AND COALESCE(TRIM(ebs."Unique ID"), '') <> '' THEN UPPER(TRIM(ebs."Unique ID"))
     ELSE UPPER(TRIM(ebs."Team"))
   END
  WHERE ebs.series_id IS NOT NULL
    AND ebs."Round" IS NOT NULL
    AND TRIM(ebs."Round") <> ''
    AND etp.participant_norm IS NULL
    AND NOT (LOWER(TRIM(ebs."Stage")) LIKE '%playoff%')
  GROUP BY
    TRIM(ebs."Season"),
    TRIM(ebs."Split"),
    TRIM(ebs."Event"),
    CASE
      WHEN LOWER(TRIM(ebs."mode")) = '1s' AND COALESCE(TRIM(ebs."Unique ID"), '') <> '' THEN UPPER(TRIM(ebs."Unique ID"))
      ELSE UPPER(TRIM(ebs."Team"))
    END,
    UPPER(TRIM(ebs."Round")),
    ebs.series_id,
    ebs."Game Number"
),
event_non_playoff_series_results AS (
  SELECT
    season,
    split,
    event,
    participant_norm,
    team,
    rnd,
    depth,
    series_id,
    MAX(best_of) AS best_of,
    MAX(match_date) AS match_date,
    SUM(CASE WHEN game_won THEN 1 ELSE 0 END) AS wins
  FROM event_non_playoff_game_results
  GROUP BY season, split, event, participant_norm, team, rnd, depth, series_id
),
event_non_playoff_losses AS (
  SELECT
    season,
    split,
    event,
    participant_norm,
    team,
    rnd,
    depth,
    series_id,
    match_date
  FROM event_non_playoff_series_results
  WHERE wins < CEIL(best_of / 2.0)
),
event_non_playoff_elimination AS (
  SELECT
    ranked.season,
    ranked.split,
    ranked.event,
    ranked.participant_norm,
    ranked.team,
    ranked.depth AS elimination_depth
  FROM (
    SELECT
      enl.*,
      ROW_NUMBER() OVER (
        PARTITION BY enl.season, enl.split, enl.event, enl.participant_norm
        ORDER BY enl.depth DESC, enl.match_date DESC NULLS LAST, enl.series_id DESC
      ) AS rn
    FROM event_non_playoff_losses enl
    WHERE enl.depth > 0
  ) ranked
  WHERE ranked.rn = 1
),
event_non_playoff_groups AS (
  SELECT
    season,
    split,
    event,
    elimination_depth,
    COUNT(*) AS team_count
  FROM event_non_playoff_elimination
  GROUP BY season, split, event, elimination_depth
),
event_non_playoff_ranges AS (
  SELECT
    enpg.season,
    enpg.split,
    enpg.event,
    enpg.elimination_depth,
    enpg.team_count,
    COALESCE(epa.placement_anchor, 0) + COALESCE(
      SUM(enpg.team_count) OVER (
        PARTITION BY enpg.season, enpg.split, enpg.event
        ORDER BY enpg.elimination_depth DESC
        ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
      ),
      0
    ) + 1 AS placement_start
  FROM event_non_playoff_groups enpg
  LEFT JOIN event_playoff_anchor epa
    ON epa.season IS NOT DISTINCT FROM enpg.season
   AND epa.split IS NOT DISTINCT FROM enpg.split
   AND epa.event IS NOT DISTINCT FROM enpg.event
),
event_non_playoff_placements AS (
  SELECT
    enpe.season,
    enpe.split,
    enpe.event,
    enpe.participant_norm,
    enpe.team,
    enpr.placement_start,
    enpr.placement_start + enpr.team_count - 1 AS placement_end
  FROM event_non_playoff_elimination enpe
  JOIN event_non_playoff_ranges enpr
    ON enpr.season IS NOT DISTINCT FROM enpe.season
   AND enpr.split IS NOT DISTINCT FROM enpe.split
   AND enpr.event IS NOT DISTINCT FROM enpe.event
   AND enpr.elimination_depth = enpe.elimination_depth
),
event_all_placements AS (
  SELECT season, split, event, participant_norm, team, placement_start, placement_end
  FROM event_team_placements
  UNION ALL
  SELECT season, split, event, participant_norm, team, placement_start, placement_end
  FROM event_non_playoff_placements
),
event_lan_group_overrides AS (
  SELECT
    eap.season,
    eap.split,
    eap.event,
    eap.participant_norm,
    CASE etl.round_depth
      WHEN 26 THEN 13
      WHEN 28 THEN 9
      WHEN 30 THEN 5
      ELSE NULL
    END AS placement_start,
    CASE etl.round_depth
      WHEN 26 THEN 16
      WHEN 28 THEN 12
      WHEN 30 THEN 8
      ELSE NULL
    END AS placement_end
  FROM event_all_placements eap
  JOIN event_team_latest etl
   ON etl.season IS NOT DISTINCT FROM eap.season
   AND etl.split IS NOT DISTINCT FROM eap.split
   AND etl.event IS NOT DISTINCT FROM eap.event
   AND etl.participant_norm = eap.participant_norm
  JOIN event_has_playoffs ehp
    ON ehp.season IS NOT DISTINCT FROM eap.season
   AND ehp.split IS NOT DISTINCT FROM eap.split
   AND ehp.event IS NOT DISTINCT FROM eap.event
  JOIN event_meta em
    ON em.season IS NOT DISTINCT FROM eap.season
   AND em.split IS NOT DISTINCT FROM eap.split
   AND em.event IS NOT DISTINCT FROM eap.event
  WHERE NOT ehp.has_playoffs
    AND em.mode = '3s'
    AND em.scope = 'international'
    AND em.tier IN ('major', 'worlds')
    AND etl.won_deepest = false
    AND etl.round_depth IN (26, 28, 30)
),
event_final_placements AS (
  SELECT
    eap.season,
    eap.split,
    eap.event,
    eap.participant_norm,
    eap.team,
    COALESCE(elgo.placement_start, eap.placement_start) AS placement_start,
    COALESCE(elgo.placement_end, eap.placement_end) AS placement_end
  FROM event_all_placements eap
  LEFT JOIN event_lan_group_overrides elgo
    ON elgo.season IS NOT DISTINCT FROM eap.season
   AND elgo.split IS NOT DISTINCT FROM eap.split
   AND elgo.event IS NOT DISTINCT FROM eap.event
   AND elgo.participant_norm = eap.participant_norm
),
event_placement AS (
  SELECT
    pep.season,
    pep.split,
    pep.event,
    pep.team,
    eap.placement_start,
    eap.placement_end,
    CASE
      WHEN eap.placement_start IS NULL OR eap.placement_end IS NULL THEN NULL
      WHEN eap.placement_start >= 999 OR eap.placement_end >= 999 THEN NULL
      WHEN eap.placement_start = eap.placement_end THEN CONCAT('Top ', eap.placement_end::text)
      WHEN eap.placement_start < eap.placement_end THEN CONCAT('Top ', eap.placement_start::text, '-', eap.placement_end::text)
      ELSE NULL
    END AS placement
  FROM player_event_participant pep
  LEFT JOIN event_final_placements eap
    ON eap.season IS NOT DISTINCT FROM pep.season
   AND eap.split IS NOT DISTINCT FROM pep.split
   AND eap.event IS NOT DISTINCT FROM pep.event
   AND eap.participant_norm = pep.participant_norm
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
          WHEN UPPER(TRIM(sw.round)) = '5' THEN 30
          WHEN UPPER(TRIM(sw.round)) = 'R5' THEN 30
          WHEN UPPER(TRIM(sw.round)) = 'ROUND 5' THEN 30
          WHEN UPPER(TRIM(sw.round)) = 'SWISS 4' THEN 28
          WHEN UPPER(TRIM(sw.round)) = '4' THEN 28
          WHEN UPPER(TRIM(sw.round)) = 'R4' THEN 28
          WHEN UPPER(TRIM(sw.round)) = 'ROUND 4' THEN 28
          WHEN UPPER(TRIM(sw.round)) = 'SWISS 3' THEN 26
          WHEN UPPER(TRIM(sw.round)) = '3' THEN 26
          WHEN UPPER(TRIM(sw.round)) = 'R3' THEN 26
          WHEN UPPER(TRIM(sw.round)) = 'ROUND 3' THEN 26
          WHEN UPPER(TRIM(sw.round)) = 'SWISS 2' THEN 24
          WHEN UPPER(TRIM(sw.round)) = '2' THEN 24
          WHEN UPPER(TRIM(sw.round)) = 'R2' THEN 24
          WHEN UPPER(TRIM(sw.round)) = 'ROUND 2' THEN 24
          WHEN UPPER(TRIM(sw.round)) = 'SWISS 1' THEN 22
          WHEN UPPER(TRIM(sw.round)) = '1' THEN 22
          WHEN UPPER(TRIM(sw.round)) = 'ROUND 1' THEN 22
          WHEN UPPER(TRIM(sw.round)) = 'GROUPS' THEN 12
          ELSE 0
        END DESC,
        sw.match_date DESC NULLS LAST,
        sw.series_id DESC
    ) AS rn
  FROM series_winners sw
  LEFT JOIN opponent_summary os ON sw.series_id = os.series_id
),
series_by_event AS (
  SELECT
    sd.season,
    sd.split,
    sd.event,
    JSON_AGG(
      JSON_BUILD_OBJECT(
        'series_id', sd.series_id,
        'round', sd.round,
        'stage', sd.stage,
        'opponent', sd.opponent,
        'player_wins', sd.player_wins,
        'opponent_wins', sd.opponent_wins,
        'best_of', sd.best_of,
        'won_series', sd.won_series,
        'date', sd.match_date
      )
      ORDER BY sd.match_date ASC NULLS LAST
    ) AS series
  FROM series_detail sd
  WHERE sd.rn = 1
  GROUP BY sd.season, sd.split, sd.event
),
event_latest_dates AS (
  SELECT season, split, event, MAX(match_date) AS latest_date
  FROM series_summary
  GROUP BY season, split, event
),
event_completion AS (
  SELECT
    season,
    split,
    event,
    BOOL_OR(placement_start = 1 AND placement_end = 1) AS is_completed
  FROM event_final_placements
  GROUP BY season, split, event
),
available_seasons_json AS (
  SELECT JSON_AGG(a.season) AS available_seasons
  FROM available_seasons a
)
SELECT
  ep.season,
  ep.split,
  ep.event,
  md5(
    LOWER(TRIM(COALESCE(ep.season, ''))) || '|' ||
    LOWER(TRIM(COALESCE(ep.split, ''))) || '|' ||
    LOWER(TRIM(COALESCE(ep.event, ''))) || '|' ||
    LOWER(TRIM(COALESCE(em.mode, ''))) || '|' ||
    LOWER(TRIM(COALESCE(em.scope, ''))) || '|' ||
    LOWER(TRIM(COALESCE(em.tier, '')))
  ) AS event_id,
  ep.team,
  em.mode,
  em.scope,
  em.tier,
  ep.placement_start,
  ep.placement_end,
  ep.placement,
  CASE
    WHEN COALESCE(ec.is_completed, false) THEN 'completed'
    ELSE 'in_progress'
  END AS status,
  sbe.series,
  asj.available_seasons
FROM event_placement ep
LEFT JOIN series_by_event sbe
  ON sbe.season IS NOT DISTINCT FROM ep.season
 AND sbe.split IS NOT DISTINCT FROM ep.split
 AND sbe.event IS NOT DISTINCT FROM ep.event
LEFT JOIN event_latest_dates ed
  ON ep.season IS NOT DISTINCT FROM ed.season
   AND ep.split IS NOT DISTINCT FROM ed.split
   AND ep.event IS NOT DISTINCT FROM ed.event
LEFT JOIN event_meta em
  ON em.season IS NOT DISTINCT FROM ep.season
 AND em.split IS NOT DISTINCT FROM ep.split
 AND em.event IS NOT DISTINCT FROM ep.event
LEFT JOIN event_completion ec
  ON ec.season IS NOT DISTINCT FROM ep.season
 AND ec.split IS NOT DISTINCT FROM ep.split
 AND ec.event IS NOT DISTINCT FROM ep.event
CROSS JOIN available_seasons_json asj
ORDER BY ed.latest_date DESC NULLS LAST;
