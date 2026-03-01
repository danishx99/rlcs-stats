-- data-integrity.sql
-- Audit-only integrity suite for RLCS stats data.
-- Default scope: regional 3s only (excludes international LAN + 1s/2s tracks).
-- Output schema:
--   check_id, severity, status, metric_name, metric_value, threshold, sample_json

WITH base_stats AS (
  SELECT
    s."Match ID" AS match_id,
    s."Game Number" AS game_number,
    s."Date" AS match_ts,
    s."Date"::date AS match_date,
    s."Season" AS season,
    s."Split" AS split,
    s."Event" AS event,
    s."Stage" AS stage,
    s."Round" AS round,
    s."Best of " AS best_of,
    TRIM(s."Team") AS team_key,
    NULLIF(TRIM(s."Unique ID"), '') AS player_key,
    s."Victory" AS victory,
    s."OT" AS ot,
    s."Extra Time" AS extra_time,
    s."Goals_All Zones" AS goals_all,
    s."Assists_All Zones" AS assists_all,
    s."Saves_All Zones" AS saves_all,
    s."Shots_All Zones" AS shots_all,
    s."Score_All Zones" AS score_all,
    s."Kills_All Zones" AS kills_all,
    s."Deaths_All Zones" AS deaths_all,
    s."Passes Given_All Zones" AS passes_given_all,
    s."Passes Received_All Zones" AS passes_received_all,
    s."50/50s_All Zones" AS fifty_all,
    s."Possession Losses_All Zones" AS possession_losses_all,
    s."Interceptions_All Zones" AS interceptions_all,
    s."Self Touches_All Zones" AS self_touches_all,
    s."Small Pads Collected_All Zones" AS small_pads_all,
    s."Big Boosts Collected_All Zones" AS big_boosts_all,
    s."Ball Touches_All Zones" AS ball_touches_all,
    s.series_id,
    s.source_file
  FROM stats s
  WHERE LOWER(TRIM(s."mode")) = '3s'
    AND LOWER(TRIM(s."scope")) = 'regional'
),
match_meta AS (
  SELECT
    b.match_id,
    MIN(b.match_date) AS match_date,
    MIN(b.season) AS season,
    MIN(b.split) AS split,
    MIN(b.event) AS event,
    MIN(b.stage) AS stage,
    MIN(b.round) AS round,
    MAX(b.best_of) AS best_of,
    COUNT(*) AS row_count,
    COUNT(DISTINCT b.team_key) AS team_count,
    ARRAY_AGG(DISTINCT b.team_key ORDER BY b.team_key) AS teams,
    MIN(b.source_file) AS source_file
  FROM base_stats b
  GROUP BY b.match_id
),
match_team_rows AS (
  SELECT
    b.match_id,
    b.team_key,
    COUNT(*) AS row_count,
    COUNT(*) FILTER (WHERE b.player_key IS NULL) AS null_player_rows,
    COUNT(*) FILTER (WHERE b.player_key IS NOT NULL) AS non_null_player_rows,
    COUNT(DISTINCT b.player_key) AS distinct_players,
    COUNT(*) FILTER (WHERE b.victory IS TRUE) AS victory_true_rows,
    COUNT(*) FILTER (WHERE b.victory IS FALSE) AS victory_false_rows
  FROM base_stats b
  GROUP BY b.match_id, b.team_key
),
team_victories AS (
  SELECT
    b.match_id,
    b.team_key,
    BOOL_OR(COALESCE(b.victory, FALSE)) AS team_won,
    BOOL_AND(COALESCE(b.victory, FALSE)) AS all_rows_win,
    SUM(COALESCE(b.goals_all, 0)) AS team_goals
  FROM base_stats b
  GROUP BY b.match_id, b.team_key
),
match_outcomes AS (
  SELECT
    tv.match_id,
    COUNT(*) AS teams_in_outcome,
    COUNT(*) FILTER (WHERE tv.team_won) AS winners,
    MAX(tv.team_goals) AS max_goals,
    MIN(tv.team_goals) AS min_goals,
    MAX(tv.team_key) FILTER (WHERE tv.team_won) AS flagged_winner_team
  FROM team_victories tv
  GROUP BY tv.match_id
),
goal_winners AS (
  SELECT
    tv.match_id,
    MAX(tv.team_key) AS goal_winner_team
  FROM team_victories tv
  JOIN match_outcomes mo ON mo.match_id = tv.match_id
  WHERE tv.team_goals = mo.max_goals
  GROUP BY tv.match_id
  HAVING COUNT(*) = 1
),
valid_two_team_matches AS (
  SELECT
    m.match_id,
    m.match_date,
    m.season,
    m.split,
    m.event,
    m.stage,
    m.round,
    m.best_of,
    MIN(tv.team_key) AS team_a,
    MAX(tv.team_key) AS team_b
  FROM match_meta m
  JOIN team_victories tv ON tv.match_id = m.match_id
  WHERE m.team_count = 2
  GROUP BY m.match_id, m.match_date, m.season, m.split, m.event, m.stage, m.round, m.best_of
),
series_matches AS (
  SELECT
    v.*,
    CONCAT_WS('|',
      COALESCE(v.match_date::text, ''),
      COALESCE(v.season, ''),
      COALESCE(v.split, ''),
      COALESCE(v.event, ''),
      COALESCE(v.stage, ''),
      COALESCE(v.round, ''),
      COALESCE(v.team_a, ''),
      COALESCE(v.team_b, '')
    ) AS series_key
  FROM valid_two_team_matches v
),
series_team_wins AS (
  SELECT
    sm.series_key,
    sm.best_of,
    tv.team_key,
    COUNT(*) FILTER (WHERE tv.team_won) AS wins,
    COUNT(*) AS games_seen
  FROM series_matches sm
  JOIN team_victories tv ON tv.match_id = sm.match_id
  GROUP BY sm.series_key, sm.best_of, tv.team_key
),
series_summary AS (
  SELECT
    stw.series_key,
    MAX(stw.best_of) AS best_of,
    CEIL(MAX(stw.best_of) / 2.0) AS win_threshold,
    MAX(stw.wins) AS max_wins,
    COUNT(*) FILTER (WHERE stw.wins >= CEIL(stw.best_of / 2.0)) AS teams_over_threshold,
    COUNT(DISTINCT stw.team_key) AS teams_in_series,
    SUM(stw.games_seen) / NULLIF(COUNT(DISTINCT stw.team_key), 0) AS approx_games
  FROM series_team_wins stw
  GROUP BY stw.series_key
),
legacy_series_teams AS (
  SELECT
    regexp_replace(regexp_replace(b.match_id, '-[0-9]{6}-', '-'), '-G[0-9]+$', '') AS legacy_series_id,
    COUNT(DISTINCT b.team_key) AS team_count
  FROM base_stats b
  GROUP BY 1
),
current_series_teams AS (
  SELECT
    s.series_id AS current_series_id,
    COUNT(DISTINCT TRIM(s."Team")) AS team_count
  FROM stats s
  WHERE s.series_id IS NOT NULL
  GROUP BY s.series_id
),
match_series_id_gaps AS (
  SELECT
    b.match_id,
    MIN(m.season) AS season,
    MIN(m.split) AS split,
    MIN(m.event) AS event,
    MIN(m.stage) AS stage,
    MIN(m.round) AS round,
    MAX(m.team_count) AS team_count,
    ARRAY_AGG(DISTINCT b.team_key ORDER BY b.team_key) AS teams,
    COUNT(*) FILTER (WHERE b.series_id IS NULL OR TRIM(b.series_id) = '') AS missing_series_id_rows,
    COUNT(*) AS total_rows,
    MIN(m.source_file) AS source_file
  FROM base_stats b
  JOIN match_meta m ON m.match_id = b.match_id
  GROUP BY b.match_id
  HAVING COUNT(*) FILTER (WHERE b.series_id IS NULL OR TRIM(b.series_id) = '') > 0
),
series_from_id AS (
  SELECT
    b.series_id,
    MAX(b.best_of) AS best_of,
    COUNT(DISTINCT b.best_of) AS best_of_variants,
    COUNT(*) AS row_count,
    COUNT(DISTINCT b.team_key) AS team_count,
    COUNT(DISTINCT b.match_id) AS match_count,
    COUNT(DISTINCT b.game_number) AS game_count,
    COUNT(*) FILTER (WHERE b.game_number IS NULL) AS null_game_number_rows,
    MIN(b.game_number) AS min_game_number,
    MAX(b.game_number) AS max_game_number,
    ARRAY_AGG(DISTINCT b.game_number ORDER BY b.game_number) AS game_numbers
  FROM base_stats b
  WHERE b.series_id IS NOT NULL
    AND b.best_of IN (3, 5, 7)
  GROUP BY b.series_id
),
series_game_rows AS (
  SELECT
    b.series_id,
    b.game_number,
    COUNT(*) AS row_count,
    COUNT(DISTINCT b.match_id) AS match_count
  FROM base_stats b
  WHERE b.series_id IS NOT NULL
    AND b.best_of IN (3, 5, 7)
  GROUP BY b.series_id, b.game_number
),
series_game_shape AS (
  SELECT
    sgr.series_id,
    COUNT(*) FILTER (WHERE sgr.row_count <> 6) AS games_with_bad_row_count,
    COALESCE(
      JSONB_AGG(
        JSONB_BUILD_OBJECT(
          'game_number', sgr.game_number,
          'row_count', sgr.row_count,
          'match_count', sgr.match_count
        )
        ORDER BY sgr.game_number
      ) FILTER (WHERE sgr.row_count <> 6),
      '[]'::jsonb
    ) AS bad_games_json
  FROM series_game_rows sgr
  GROUP BY sgr.series_id
),
series_id_integrity_failures AS (
  SELECT
    sfi.series_id,
    sfi.best_of,
    CEIL(sfi.best_of / 2.0)::int AS min_required_games,
    sfi.best_of_variants,
    sfi.row_count,
    sfi.team_count,
    sfi.match_count,
    sfi.game_count,
    sfi.null_game_number_rows,
    sfi.min_game_number,
    sfi.max_game_number,
    sfi.game_numbers,
    COALESCE(sgs.games_with_bad_row_count, 0) AS games_with_bad_row_count,
    COALESCE(sgs.bad_games_json, '[]'::jsonb) AS bad_games_json,
    (
      sfi.best_of_variants <> 1
      OR sfi.team_count <> 2
      OR sfi.null_game_number_rows > 0
      OR sfi.game_count < CEIL(sfi.best_of / 2.0)
      OR sfi.game_count > sfi.best_of
      OR sfi.min_game_number <> 1
      OR sfi.max_game_number <> sfi.game_count
      OR sfi.row_count <> (sfi.game_count * 6)
      OR sfi.match_count <> sfi.game_count
      OR COALESCE(sgs.games_with_bad_row_count, 0) > 0
    ) AS has_issue
  FROM series_from_id sfi
  LEFT JOIN series_game_shape sgs ON sgs.series_id = sfi.series_id
),
fractional_non_ot_rows AS (
  SELECT
    b.match_id,
    b.team_key,
    b.player_key,
    b.season
  FROM base_stats b
  WHERE COALESCE(b.ot, FALSE) = FALSE
    AND COALESCE(b.extra_time, 0) <= 0
    AND (
      (b.goals_all IS NOT NULL AND b.goals_all <> TRUNC(b.goals_all)) OR
      (b.assists_all IS NOT NULL AND b.assists_all <> TRUNC(b.assists_all)) OR
      (b.saves_all IS NOT NULL AND b.saves_all <> TRUNC(b.saves_all)) OR
      (b.shots_all IS NOT NULL AND b.shots_all <> TRUNC(b.shots_all)) OR
      (b.score_all IS NOT NULL AND b.score_all <> TRUNC(b.score_all)) OR
      (b.kills_all IS NOT NULL AND b.kills_all <> TRUNC(b.kills_all)) OR
      (b.deaths_all IS NOT NULL AND b.deaths_all <> TRUNC(b.deaths_all)) OR
      (b.passes_given_all IS NOT NULL AND b.passes_given_all <> TRUNC(b.passes_given_all)) OR
      (b.passes_received_all IS NOT NULL AND b.passes_received_all <> TRUNC(b.passes_received_all)) OR
      (b.fifty_all IS NOT NULL AND b.fifty_all <> TRUNC(b.fifty_all)) OR
      (b.possession_losses_all IS NOT NULL AND b.possession_losses_all <> TRUNC(b.possession_losses_all)) OR
      (b.interceptions_all IS NOT NULL AND b.interceptions_all <> TRUNC(b.interceptions_all)) OR
      (b.self_touches_all IS NOT NULL AND b.self_touches_all <> TRUNC(b.self_touches_all)) OR
      (b.small_pads_all IS NOT NULL AND b.small_pads_all <> TRUNC(b.small_pads_all)) OR
      (b.big_boosts_all IS NOT NULL AND b.big_boosts_all <> TRUNC(b.big_boosts_all)) OR
      (b.ball_touches_all IS NOT NULL AND b.ball_touches_all <> TRUNC(b.ball_touches_all))
    )
),
dimension_values AS (
  SELECT 'Split'::text AS dimension, b.split::text AS raw_value FROM base_stats b
  UNION ALL
  SELECT 'Event'::text AS dimension, b.event::text AS raw_value FROM base_stats b
  UNION ALL
  SELECT 'Stage'::text AS dimension, b.stage::text AS raw_value FROM base_stats b
  UNION ALL
  SELECT 'Round'::text AS dimension, b.round::text AS raw_value FROM base_stats b
  UNION ALL
  SELECT 'Team'::text AS dimension, b.team_key::text AS raw_value FROM base_stats b
),
whitespace_summary AS (
  SELECT
    d.dimension,
    COUNT(DISTINCT d.raw_value) FILTER (WHERE d.raw_value IS NOT NULL) AS raw_distinct,
    COUNT(DISTINCT NULLIF(TRIM(d.raw_value), '')) FILTER (WHERE d.raw_value IS NOT NULL) AS trimmed_distinct,
    COUNT(*) FILTER (
      WHERE d.raw_value IS NOT NULL
      AND d.raw_value <> TRIM(d.raw_value)
    ) AS rows_with_outer_whitespace
  FROM dimension_values d
  GROUP BY d.dimension
),
case_team_variants AS (
  SELECT
    UPPER(b.team_key) AS canonical_team,
    COUNT(DISTINCT b.team_key) AS variants,
    ARRAY_AGG(DISTINCT b.team_key ORDER BY b.team_key) AS names
  FROM base_stats b
  WHERE NULLIF(TRIM(b.team_key), '') IS NOT NULL
  GROUP BY UPPER(b.team_key)
  HAVING COUNT(DISTINCT b.team_key) > 1
),
player_name_id_variants AS (
  SELECT
    NULLIF(TRIM(s."Player Name"), '') AS player_name,
    COUNT(DISTINCT b.player_key) AS unique_id_count,
    ARRAY_AGG(DISTINCT b.player_key ORDER BY b.player_key)
      FILTER (WHERE b.player_key IS NOT NULL) AS unique_ids,
    COUNT(*) AS row_count
  FROM stats s
  JOIN base_stats b ON b.match_id = s."Match ID"
    AND b.game_number = s."Game Number"
    AND b.team_key IS NOT DISTINCT FROM TRIM(s."Team")
    AND b.player_key IS NOT DISTINCT FROM NULLIF(TRIM(s."Unique ID"), '')
  WHERE NULLIF(TRIM(s."Player Name"), '') IS NOT NULL
    -- Known exception: "Shadow" is used by multiple real players in this dataset.
    AND LOWER(TRIM(s."Player Name")) <> 'shadow'
  GROUP BY NULLIF(TRIM(s."Player Name"), '')
  HAVING COUNT(DISTINCT b.player_key) > 1
),
playoff_team_series AS (
  SELECT
    NULLIF(TRIM(b.season), '') AS season,
    NULLIF(TRIM(b.split), '') AS split,
    NULLIF(TRIM(b.event), '') AS event,
    b.series_id,
    UPPER(TRIM(b.round)) AS round_key,
    MAX(b.match_ts) AS series_date,
    b.team_key,
    SUM(CASE WHEN b.victory IS TRUE THEN 1 ELSE 0 END) AS game_wins
  FROM base_stats b
  WHERE b.series_id IS NOT NULL
    AND LOWER(TRIM(COALESCE(b.stage, ''))) = 'playoffs'
    AND NULLIF(TRIM(b.team_key), '') IS NOT NULL
  GROUP BY
    NULLIF(TRIM(b.season), ''),
    NULLIF(TRIM(b.split), ''),
    NULLIF(TRIM(b.event), ''),
    b.series_id,
    UPPER(TRIM(b.round)),
    b.team_key
),
playoff_series_catalog AS (
  SELECT DISTINCT
    pts.season,
    pts.split,
    pts.event,
    pts.series_id,
    pts.series_date
  FROM playoff_team_series pts
),
playoff_series_instances_marked AS (
  SELECT
    psc.*,
    CASE
      WHEN LAG(psc.series_date) OVER (
        PARTITION BY psc.season, psc.split, psc.event
        ORDER BY psc.series_date, psc.series_id
      ) IS NULL THEN 1
      WHEN psc.series_date - LAG(psc.series_date) OVER (
        PARTITION BY psc.season, psc.split, psc.event
        ORDER BY psc.series_date, psc.series_id
      ) > INTERVAL '7 days' THEN 1
      ELSE 0
    END AS starts_new_instance
  FROM playoff_series_catalog psc
),
playoff_series_instances AS (
  SELECT
    psim.season,
    psim.split,
    psim.event,
    psim.series_id,
    psim.series_date,
    SUM(psim.starts_new_instance) OVER (
      PARTITION BY psim.season, psim.split, psim.event
      ORDER BY psim.series_date, psim.series_id
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    )::int AS event_instance_id
  FROM playoff_series_instances_marked psim
),
playoff_team_series_scoped AS (
  SELECT
    pts.*,
    psi.event_instance_id
  FROM playoff_team_series pts
  JOIN playoff_series_instances psi
    ON  pts.season IS NOT DISTINCT FROM psi.season
    AND pts.split IS NOT DISTINCT FROM psi.split
    AND pts.event IS NOT DISTINCT FROM psi.event
    AND pts.series_id = psi.series_id
),
playoff_series_ranked AS (
  SELECT
    pts.*,
    RANK() OVER (PARTITION BY pts.series_id ORDER BY pts.game_wins DESC) AS series_rank
  FROM playoff_team_series_scoped pts
),
playoff_team_latest AS (
  SELECT DISTINCT ON (season, split, event, event_instance_id, team_key)
    season,
    split,
    event,
    event_instance_id,
    team_key,
    round_key,
    series_date,
    series_id,
    game_wins,
    series_rank,
    (series_rank = 1) AS won_latest_series
  FROM playoff_series_ranked
  ORDER BY season, split, event, event_instance_id, team_key, series_date DESC NULLS LAST, series_id DESC
),
playoff_unresolved_winners AS (
  SELECT
    ptl.season,
    ptl.split,
    ptl.event,
    ptl.event_instance_id,
    ptl.team_key,
    ptl.round_key,
    ptl.series_date,
    ptl.series_id,
    ptl.game_wins
  FROM playoff_team_latest ptl
  WHERE ptl.won_latest_series
    AND ptl.round_key NOT LIKE 'GF%'
),
playoff_round_depth AS (
  SELECT
    pts.*,
    CASE
      WHEN pts.round_key LIKE 'GF%'  THEN 100
      WHEN pts.round_key IN ('UF','LF')   THEN 90
      WHEN pts.round_key IN ('SF','USF','LSF') THEN 80
      WHEN pts.round_key IN ('QF','UQF','LQF') THEN 70
      WHEN pts.round_key = 'LR3'    THEN 60
      WHEN pts.round_key = 'LR2'    THEN 50
      WHEN pts.round_key IN ('LR1','UR1','R1') THEN 40
      ELSE 0
    END AS round_depth
  FROM playoff_team_series_scoped pts
),
playoff_bracket_conflicts AS (
  SELECT
    a.season,
    a.split,
    a.event,
    a.event_instance_id,
    a.team_key,
    a.round_key   AS deep_round,
    a.round_depth  AS deep_depth,
    a.series_date  AS deep_date,
    a.series_id    AS deep_series_id,
    b.round_key   AS shallow_round,
    b.round_depth  AS shallow_depth,
    b.series_date  AS shallow_date,
    b.series_id    AS shallow_series_id
  FROM playoff_round_depth a
  JOIN playoff_round_depth b
    ON  a.season   IS NOT DISTINCT FROM b.season
    AND a.split    IS NOT DISTINCT FROM b.split
    AND a.event IS NOT DISTINCT FROM b.event
    AND a.event_instance_id = b.event_instance_id
    AND a.team_key = b.team_key
    AND a.series_id <> b.series_id
  WHERE a.round_depth > b.round_depth
    AND a.series_date < b.series_date
    AND NOT (a.round_key LIKE 'U%' AND b.round_key LIKE 'L%')
),
checks AS (
  -- C01
  SELECT
    'C01_game_team_count_exactly_two'::text AS check_id,
    'critical'::text AS severity,
    CASE WHEN COUNT(*) FILTER (WHERE m.team_count <> 2) = 0 THEN 'pass' ELSE 'fail' END::text AS status,
    'match_ids_with_team_count_not_2'::text AS metric_name,
    COUNT(*) FILTER (WHERE m.team_count <> 2)::bigint AS metric_value,
    '0'::text AS threshold,
    COALESCE((
      SELECT JSONB_AGG(JSONB_BUILD_OBJECT('match_id', x.match_id, 'team_count', x.team_count, 'teams', x.teams))
      FROM (
        SELECT m2.match_id, m2.team_count, m2.teams
        FROM match_meta m2
        WHERE m2.team_count <> 2
        ORDER BY m2.team_count DESC, m2.match_id
        LIMIT 20
      ) x
    ), '[]'::jsonb) AS sample_json
  FROM match_meta m

  UNION ALL

  -- C02
  SELECT
    'C02_match_id_row_count_expected_3v3',
    'critical',
    CASE WHEN COUNT(*) FILTER (WHERE m.row_count <> 6) = 0 THEN 'pass' ELSE 'fail' END,
    'match_ids_with_row_count_not_6',
    COUNT(*) FILTER (WHERE m.row_count <> 6)::bigint,
    '0',
    COALESCE((
      SELECT JSONB_AGG(JSONB_BUILD_OBJECT('match_id', x.match_id, 'row_count', x.row_count, 'team_count', x.team_count))
      FROM (
        SELECT m2.match_id, m2.row_count, m2.team_count
        FROM match_meta m2
        WHERE m2.row_count <> 6
        ORDER BY ABS(m2.row_count - 6) DESC, m2.match_id
        LIMIT 20
      ) x
    ), '[]'::jsonb)
  FROM match_meta m

  UNION ALL

  -- C03
  SELECT
    'C03_team_rows_per_match_expected_three',
    'critical',
    CASE WHEN COUNT(*) FILTER (WHERE t.row_count <> 3) = 0 THEN 'pass' ELSE 'fail' END,
    'match_team_groups_with_row_count_not_3',
    COUNT(*) FILTER (WHERE t.row_count <> 3)::bigint,
    '0',
    COALESCE((
      SELECT JSONB_AGG(JSONB_BUILD_OBJECT('match_id', x.match_id, 'team', x.team_key, 'row_count', x.row_count))
      FROM (
        SELECT t2.match_id, t2.team_key, t2.row_count
        FROM match_team_rows t2
        WHERE t2.row_count <> 3
        ORDER BY ABS(t2.row_count - 3) DESC, t2.match_id, t2.team_key
        LIMIT 20
      ) x
    ), '[]'::jsonb)
  FROM match_team_rows t

  UNION ALL

  -- C04
  SELECT
    'C04_player_uniqueness_within_match_team',
    'critical',
    CASE WHEN COUNT(*) FILTER (
      WHERE t.distinct_players <> 3
         OR t.null_player_rows > 0
         OR (t.non_null_player_rows - t.distinct_players) > 0
    ) = 0 THEN 'pass' ELSE 'fail' END,
    'match_team_groups_with_player_identity_issues',
    COUNT(*) FILTER (
      WHERE t.distinct_players <> 3
         OR t.null_player_rows > 0
         OR (t.non_null_player_rows - t.distinct_players) > 0
    )::bigint,
    '0',
    COALESCE((
      SELECT JSONB_AGG(JSONB_BUILD_OBJECT(
        'match_id', x.match_id,
        'team', x.team_key,
        'distinct_players', x.distinct_players,
        'null_player_rows', x.null_player_rows,
        'duplicate_player_rows', (x.non_null_player_rows - x.distinct_players)
      ))
      FROM (
        SELECT t2.*
        FROM match_team_rows t2
        WHERE t2.distinct_players <> 3
           OR t2.null_player_rows > 0
           OR (t2.non_null_player_rows - t2.distinct_players) > 0
        ORDER BY t2.match_id, t2.team_key
        LIMIT 20
      ) x
    ), '[]'::jsonb)
  FROM match_team_rows t

  UNION ALL

  -- C05
  SELECT
    'C05_exactly_one_winning_team_per_match',
    'critical',
    CASE WHEN COUNT(*) FILTER (WHERE mo.winners <> 1) = 0 THEN 'pass' ELSE 'fail' END,
    'two_team_matches_with_winner_count_not_1',
    COUNT(*) FILTER (WHERE mo.winners <> 1)::bigint,
    '0',
    COALESCE((
      SELECT JSONB_AGG(JSONB_BUILD_OBJECT('match_id', x.match_id, 'winners', x.winners, 'teams_in_outcome', x.teams_in_outcome))
      FROM (
        SELECT mo2.match_id, mo2.winners, mo2.teams_in_outcome
        FROM match_outcomes mo2
        JOIN match_meta m2 ON m2.match_id = mo2.match_id
        WHERE m2.team_count = 2 AND mo2.winners <> 1
        ORDER BY mo2.match_id
        LIMIT 20
      ) x
    ), '[]'::jsonb)
  FROM match_outcomes mo
  JOIN match_meta m ON m.match_id = mo.match_id
  WHERE m.team_count = 2

  UNION ALL

  -- C06
  SELECT
    'C06_team_level_victory_consistency',
    'critical',
    CASE WHEN COUNT(*) FILTER (WHERE tv.team_won <> tv.all_rows_win) = 0 THEN 'pass' ELSE 'fail' END,
    'match_team_groups_with_mixed_victory_flags',
    COUNT(*) FILTER (WHERE tv.team_won <> tv.all_rows_win)::bigint,
    '0',
    COALESCE((
      SELECT JSONB_AGG(JSONB_BUILD_OBJECT('match_id', x.match_id, 'team', x.team_key, 'team_won', x.team_won, 'all_rows_win', x.all_rows_win))
      FROM (
        SELECT tv2.match_id, tv2.team_key, tv2.team_won, tv2.all_rows_win
        FROM team_victories tv2
        WHERE tv2.team_won <> tv2.all_rows_win
        ORDER BY tv2.match_id, tv2.team_key
        LIMIT 20
      ) x
    ), '[]'::jsonb)
  FROM team_victories tv

  UNION ALL

  -- C07
  SELECT
    'C07_victory_vs_goals_consistency_non_tied',
    'critical',
    CASE WHEN COUNT(*) FILTER (WHERE gw.goal_winner_team IS DISTINCT FROM mo.flagged_winner_team) = 0 THEN 'pass' ELSE 'fail' END,
    'non_tied_two_team_matches_where_goal_winner_differs_from_victory_winner',
    COUNT(*) FILTER (WHERE gw.goal_winner_team IS DISTINCT FROM mo.flagged_winner_team)::bigint,
    '0',
    COALESCE((
      SELECT JSONB_AGG(JSONB_BUILD_OBJECT(
        'match_id', x.match_id,
        'goal_winner_team', x.goal_winner_team,
        'victory_winner_team', x.flagged_winner_team,
        'max_goals', x.max_goals,
        'min_goals', x.min_goals
      ))
      FROM (
        SELECT mo2.match_id, gw2.goal_winner_team, mo2.flagged_winner_team, mo2.max_goals, mo2.min_goals
        FROM match_outcomes mo2
        JOIN match_meta m2 ON m2.match_id = mo2.match_id
        JOIN goal_winners gw2 ON gw2.match_id = mo2.match_id
        WHERE m2.team_count = 2
          AND mo2.winners = 1
          AND mo2.max_goals <> mo2.min_goals
          AND gw2.goal_winner_team IS DISTINCT FROM mo2.flagged_winner_team
        ORDER BY mo2.match_id
        LIMIT 20
      ) x
    ), '[]'::jsonb)
  FROM match_outcomes mo
  JOIN match_meta m ON m.match_id = mo.match_id
  JOIN goal_winners gw ON gw.match_id = mo.match_id
  WHERE m.team_count = 2
    AND mo.winners = 1
    AND mo.max_goals <> mo.min_goals

  UNION ALL

  -- C08
  SELECT
    'C08_series_best_of_consistency',
    'critical',
    CASE WHEN COUNT(*) FILTER (WHERE s.best_of_variants > 1) = 0 THEN 'pass' ELSE 'fail' END,
    'derived_series_keys_with_conflicting_best_of',
    COUNT(*) FILTER (WHERE s.best_of_variants > 1)::bigint,
    '0',
    COALESCE((
      SELECT JSONB_AGG(JSONB_BUILD_OBJECT('series_key', x.series_key, 'best_of_variants', x.best_of_variants, 'best_of_values', x.best_of_values))
      FROM (
        SELECT
          sm.series_key,
          COUNT(DISTINCT sm.best_of) AS best_of_variants,
          ARRAY_AGG(DISTINCT sm.best_of ORDER BY sm.best_of) AS best_of_values
        FROM series_matches sm
        GROUP BY sm.series_key
        HAVING COUNT(DISTINCT sm.best_of) > 1
        ORDER BY sm.series_key
        LIMIT 20
      ) x
    ), '[]'::jsonb)
  FROM (
    SELECT sm.series_key, COUNT(DISTINCT sm.best_of) AS best_of_variants
    FROM series_matches sm
    GROUP BY sm.series_key
  ) s

  UNION ALL

  -- C09
  SELECT
    'C09_series_winner_threshold_coherence',
    'critical',
    CASE WHEN COUNT(*) FILTER (
      WHERE s.teams_over_threshold > 1
         OR (s.best_of IS NOT NULL AND s.max_wins > s.best_of)
         OR (s.best_of IS NOT NULL AND s.approx_games >= s.best_of AND s.teams_over_threshold = 0)
    ) = 0 THEN 'pass' ELSE 'fail' END,
    'derived_series_keys_with_impossible_winner_state',
    COUNT(*) FILTER (
      WHERE s.teams_over_threshold > 1
         OR (s.best_of IS NOT NULL AND s.max_wins > s.best_of)
         OR (s.best_of IS NOT NULL AND s.approx_games >= s.best_of AND s.teams_over_threshold = 0)
    )::bigint,
    '0',
    COALESCE((
      SELECT JSONB_AGG(JSONB_BUILD_OBJECT(
        'series_key', x.series_key,
        'best_of', x.best_of,
        'win_threshold', x.win_threshold,
        'max_wins', x.max_wins,
        'teams_over_threshold', x.teams_over_threshold,
        'approx_games', x.approx_games
      ))
      FROM (
        SELECT s2.*
        FROM series_summary s2
        WHERE s2.teams_over_threshold > 1
           OR (s2.best_of IS NOT NULL AND s2.max_wins > s2.best_of)
           OR (s2.best_of IS NOT NULL AND s2.approx_games >= s2.best_of AND s2.teams_over_threshold = 0)
        ORDER BY s2.series_key
        LIMIT 20
      ) x
    ), '[]'::jsonb)
  FROM series_summary s

  UNION ALL

  -- C10
  SELECT
    'C10_issue_A_match_id_collisions',
    'critical',
    CASE WHEN COUNT(*) FILTER (WHERE m.team_count > 2) = 0 THEN 'pass' ELSE 'fail' END,
    'match_ids_with_more_than_2_teams',
    COUNT(*) FILTER (WHERE m.team_count > 2)::bigint,
    '0',
    COALESCE((
      SELECT JSONB_AGG(JSONB_BUILD_OBJECT('match_id', x.match_id, 'team_count', x.team_count, 'teams', x.teams))
      FROM (
        SELECT m2.match_id, m2.team_count, m2.teams
        FROM match_meta m2
        WHERE m2.team_count > 2
        ORDER BY m2.team_count DESC, m2.match_id
        LIMIT 20
      ) x
    ), '[]'::jsonb)
  FROM match_meta m

  UNION ALL

  -- C11
  SELECT
    'C11_issue_B_series_id_collision_risk',
    'critical',
    CASE
      WHEN (
        SELECT COUNT(*) FROM current_series_teams c WHERE c.team_count > 2
      ) = 0 THEN 'pass'
      ELSE 'fail'
    END,
    'current_series_ids_with_more_than_2_teams',
    (
      SELECT COUNT(*)::bigint FROM current_series_teams c WHERE c.team_count > 2
    ),
    '0',
    JSONB_BUILD_OBJECT(
      'current_collisions', (SELECT COUNT(*) FROM current_series_teams c WHERE c.team_count > 2),
      'legacy_collisions', (SELECT COUNT(*) FROM legacy_series_teams l WHERE l.team_count > 2),
      'worst_current_team_count', (SELECT COALESCE(MAX(c.team_count), 0) FROM current_series_teams c),
      'worst_legacy_team_count', (SELECT COALESCE(MAX(l.team_count), 0) FROM legacy_series_teams l)
    )

  UNION ALL

  -- C12
  SELECT
    'C12_issue_C_no_winner_matches',
    'critical',
    CASE WHEN COUNT(*) FILTER (WHERE mo.winners = 0) = 0 THEN 'pass' ELSE 'fail' END,
    'two_team_matches_with_zero_winners',
    COUNT(*) FILTER (WHERE mo.winners = 0)::bigint,
    '0',
    COALESCE((
      SELECT JSONB_AGG(JSONB_BUILD_OBJECT('season', x.season, 'matches', x.matches))
      FROM (
        SELECT m2.season, COUNT(*) AS matches
        FROM match_outcomes mo2
        JOIN match_meta m2 ON m2.match_id = mo2.match_id
        WHERE m2.team_count = 2 AND mo2.winners = 0
        GROUP BY m2.season
        ORDER BY matches DESC, m2.season
        LIMIT 20
      ) x
    ), '[]'::jsonb)
  FROM match_outcomes mo
  JOIN match_meta m ON m.match_id = mo.match_id
  WHERE m.team_count = 2

  UNION ALL

  -- C13
  SELECT
    'C13_issue_D_double_winner_matches',
    'critical',
    CASE WHEN COUNT(*) FILTER (WHERE mo.winners > 1) = 0 THEN 'pass' ELSE 'fail' END,
    'two_team_matches_with_more_than_one_winner',
    COUNT(*) FILTER (WHERE mo.winners > 1)::bigint,
    '0',
    COALESCE((
      SELECT JSONB_AGG(JSONB_BUILD_OBJECT('season', x.season, 'matches', x.matches))
      FROM (
        SELECT m2.season, COUNT(*) AS matches
        FROM match_outcomes mo2
        JOIN match_meta m2 ON m2.match_id = mo2.match_id
        WHERE m2.team_count = 2 AND mo2.winners > 1
        GROUP BY m2.season
        ORDER BY matches DESC, m2.season
        LIMIT 20
      ) x
    ), '[]'::jsonb)
  FROM match_outcomes mo
  JOIN match_meta m ON m.match_id = mo.match_id
  WHERE m.team_count = 2

  UNION ALL

  -- C14
  SELECT
    'C14_player_name_unique_id_consistency',
    'critical',
    CASE WHEN COUNT(*) = 0 THEN 'pass' ELSE 'fail' END,
    'player_names_with_multiple_unique_ids',
    COUNT(*)::bigint,
    '0',
    COALESCE((
      SELECT JSONB_AGG(JSONB_BUILD_OBJECT(
        'player_name', x.player_name,
        'unique_id_count', x.unique_id_count,
        'unique_ids', x.unique_ids,
        'row_count', x.row_count
      ))
      FROM (
        SELECT pniv.*
        FROM player_name_id_variants pniv
        ORDER BY pniv.unique_id_count DESC, pniv.row_count DESC, pniv.player_name
        LIMIT 20
      ) x
    ), '[]'::jsonb)
  FROM player_name_id_variants

  UNION ALL

  -- W14
  SELECT
    'W14_issue_E_fractional_counts_non_ot',
    'warning',
    CASE WHEN COUNT(*) = 0 THEN 'pass' ELSE 'fail' END,
    'player_rows_with_fractional_count_stats_in_non_ot',
    COUNT(*)::bigint,
    '0',
    COALESCE((
      SELECT JSONB_AGG(JSONB_BUILD_OBJECT('season', x.season, 'rows', x.rows))
      FROM (
        SELECT f.season, COUNT(*) AS rows
        FROM fractional_non_ot_rows f
        GROUP BY f.season
        ORDER BY rows DESC, f.season
        LIMIT 20
      ) x
    ), '[]'::jsonb)
  FROM fractional_non_ot_rows

  UNION ALL

  -- C15
  SELECT
    'C15_issue_F_single_team_matches',
    'critical',
    CASE WHEN COUNT(*) FILTER (WHERE m.team_count = 1) = 0 THEN 'pass' ELSE 'fail' END,
    'match_ids_with_single_team_only',
    COUNT(*) FILTER (WHERE m.team_count = 1)::bigint,
    '0',
    COALESCE((
      SELECT JSONB_AGG(JSONB_BUILD_OBJECT('match_id', x.match_id, 'team', x.team, 'season', x.season))
      FROM (
        SELECT
          m2.match_id,
          m2.teams[1] AS team,
          m2.season
        FROM match_meta m2
        WHERE m2.team_count = 1
        ORDER BY m2.season, m2.match_id
        LIMIT 20
      ) x
    ), '[]'::jsonb)
  FROM match_meta m

  UNION ALL

  -- C16
  SELECT
    'C16_series_id_best_of_row_completeness',
    'critical',
    CASE WHEN COUNT(*) FILTER (WHERE s.has_issue) = 0 THEN 'pass' ELSE 'fail' END,
    'series_ids_with_best_of_shape_or_row_count_issues',
    COUNT(*) FILTER (WHERE s.has_issue)::bigint,
    '0',
    COALESCE((
      SELECT JSONB_AGG(JSONB_BUILD_OBJECT(
        'series_id', x.series_id,
        'best_of', x.best_of,
        'min_required_games', x.min_required_games,
        'game_count', x.game_count,
        'match_count', x.match_count,
        'row_count', x.row_count,
        'game_numbers', x.game_numbers,
        'games_with_bad_row_count', x.games_with_bad_row_count,
        'bad_games', x.bad_games_json,
        'best_of_variants', x.best_of_variants,
        'team_count', x.team_count,
        'null_game_number_rows', x.null_game_number_rows
      ))
      FROM (
        SELECT sif.*
        FROM series_id_integrity_failures sif
        WHERE sif.has_issue
        ORDER BY
          sif.best_of,
          sif.series_id
        LIMIT 20
      ) x
    ), '[]'::jsonb)
  FROM series_id_integrity_failures s

  UNION ALL

  -- C19
  SELECT
    'C19_match_ids_with_missing_series_id_rows',
    'critical',
    CASE WHEN COUNT(*) = 0 THEN 'pass' ELSE 'fail' END,
    'match_ids_with_null_or_blank_series_id_rows',
    COUNT(*)::bigint,
    '0',
    COALESCE((
      SELECT JSONB_AGG(JSONB_BUILD_OBJECT(
        'match_id', x.match_id,
        'season', x.season,
        'split', x.split,
        'event', x.event,
        'stage', x.stage,
        'round', x.round,
        'team_count', x.team_count,
        'teams', x.teams,
        'missing_series_id_rows', x.missing_series_id_rows,
        'total_rows', x.total_rows,
        'source_file', x.source_file
      ))
      FROM (
        SELECT msg.*
        FROM match_series_id_gaps msg
        ORDER BY msg.missing_series_id_rows DESC, msg.match_id
        LIMIT 20
      ) x
    ), '[]'::jsonb)
  FROM match_series_id_gaps

  UNION ALL

  -- C17
  SELECT
    'C17_playoff_missing_followup_series_after_latest_win',
    'critical',
    CASE WHEN COUNT(*) = 0 THEN 'pass' ELSE 'fail' END,
    'playoff_teams_with_latest_series_win_but_no_recorded_followup',
    COUNT(*)::bigint,
    '0',
    COALESCE((
      SELECT JSONB_AGG(JSONB_BUILD_OBJECT(
        'season', x.season,
        'split', x.split,
        'event', x.event,
        'event_instance_id', x.event_instance_id,
        'team', x.team_key,
        'latest_round', x.round_key,
        'latest_series_id', x.series_id,
        'latest_series_date', x.series_date,
        'latest_series_game_wins', x.game_wins
      ))
      FROM (
        SELECT puw.*
        FROM playoff_unresolved_winners puw
        ORDER BY puw.series_date DESC NULLS LAST, puw.season, puw.split, puw.event, puw.team_key
        LIMIT 20
      ) x
    ), '[]'::jsonb)
  FROM playoff_unresolved_winners

  UNION ALL

  -- C18
  SELECT
    'C18_playoff_bracket_depth_date_conflict',
    'critical',
    CASE WHEN COUNT(*) = 0 THEN 'pass' ELSE 'fail' END,
    'playoff_series_pairs_where_deeper_round_precedes_shallower_round',
    COUNT(*)::bigint,
    '0',
    COALESCE((
      SELECT JSONB_AGG(JSONB_BUILD_OBJECT(
        'season', x.season,
        'split', x.split,
        'event', x.event,
        'event_instance_id', x.event_instance_id,
        'team', x.team_key,
        'deep_round', x.deep_round,
        'deep_date', x.deep_date,
        'deep_series_id', x.deep_series_id,
        'shallow_round', x.shallow_round,
        'shallow_date', x.shallow_date,
        'shallow_series_id', x.shallow_series_id
      ))
      FROM (
        SELECT pbc.*
        FROM playoff_bracket_conflicts pbc
        ORDER BY pbc.season, pbc.split, pbc.event, pbc.team_key
        LIMIT 20
      ) x
    ), '[]'::jsonb)
  FROM playoff_bracket_conflicts

  UNION ALL

  -- W16
  SELECT
    'W16_dimensional_whitespace_variants',
    'warning',
    CASE WHEN COUNT(*) FILTER (WHERE ws.rows_with_outer_whitespace > 0) = 0 THEN 'pass' ELSE 'fail' END,
    'dimensions_with_outer_whitespace_variants',
    COUNT(*) FILTER (WHERE ws.rows_with_outer_whitespace > 0)::bigint,
    '0',
    COALESCE((
      SELECT JSONB_AGG(JSONB_BUILD_OBJECT(
        'dimension', x.dimension,
        'rows_with_outer_whitespace', x.rows_with_outer_whitespace,
        'raw_distinct', x.raw_distinct,
        'trimmed_distinct', x.trimmed_distinct
      ))
      FROM (
        SELECT ws2.*
        FROM whitespace_summary ws2
        WHERE ws2.rows_with_outer_whitespace > 0
        ORDER BY ws2.rows_with_outer_whitespace DESC, ws2.dimension
      ) x
    ), '[]'::jsonb)
  FROM whitespace_summary ws

  UNION ALL

  -- W17
  SELECT
    'W17_case_variants_team_names',
    'warning',
    CASE WHEN COUNT(*) = 0 THEN 'pass' ELSE 'fail' END,
    'canonical_team_keys_with_case_variants',
    COUNT(*)::bigint,
    '0',
    COALESCE((
      SELECT JSONB_AGG(JSONB_BUILD_OBJECT('canonical_team', x.canonical_team, 'variants', x.variants, 'names', x.names))
      FROM (
        SELECT ctv.*
        FROM case_team_variants ctv
        ORDER BY ctv.variants DESC, ctv.canonical_team
        LIMIT 20
      ) x
    ), '[]'::jsonb)
  FROM case_team_variants
)
SELECT
  check_id,
  severity,
  status,
  metric_name,
  metric_value,
  threshold,
  sample_json
FROM checks
ORDER BY check_id;
