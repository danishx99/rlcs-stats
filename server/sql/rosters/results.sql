WITH params AS (
  SELECT
    CASE
      WHEN {{rosterIdParam}} LIKE 'org:%' OR {{rosterIdParam}} LIKE 'roster:%' THEN {{rosterIdParam}}
      ELSE 'roster:' || {{rosterIdParam}}
    END AS team_group_id,
    CASE
      WHEN {{rosterIdParam}} LIKE 'org:%' THEN true
      ELSE false
    END AS is_org,
    CASE
      WHEN {{rosterIdParam}} LIKE 'org:%' THEN SUBSTRING({{rosterIdParam}} FROM 5)
      ELSE NULL
    END AS requested_org_norm
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
series_meta AS (
  SELECT
    s.series_id,
    UPPER(TRIM(s."Team")) AS team_norm,
    MIN(TRIM(s."Team")) AS team_label,
    MAX(s."Date") AS match_date,
    MAX(NULLIF(TRIM(s."Season"), '')) AS season,
    MAX(NULLIF(TRIM(s."Split"), '')) AS split,
    MAX(NULLIF(TRIM(s."Event"), '')) AS event,
    MAX(NULLIF(TRIM(s."Stage"), '')) AS stage,
    MIN(NULLIF(TRIM(s."Round"), '')) AS round,
    MAX(NULLIF(TRIM(s."mode"), '')) AS mode,
    MAX(NULLIF(TRIM(s."scope"), '')) AS scope,
    MAX(NULLIF(TRIM(s."tier"), '')) AS tier,
    MAX(COALESCE(s."Best of ", 0)) AS best_of
  FROM stats s
  WHERE s.series_id IS NOT NULL
    AND s."Team" IS NOT NULL
    AND TRIM(s."Team") <> ''
    {{where}}
  GROUP BY s.series_id, UPPER(TRIM(s."Team"))
),
grouped_series AS (
  SELECT
    sm.series_id,
    sm.team_norm,
    sm.team_label,
    sm.match_date,
    sm.season,
    sm.split,
    sm.event,
    sm.stage,
    sm.round,
    sm.mode,
    sm.scope,
    sm.tier,
    sm.best_of,
    sr.roster_id,
    sr.starters,
    tpn.org_name,
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
group_scope_anchor AS (
  SELECT gs.*
  FROM grouped_series gs
  JOIN params p ON p.team_group_id = gs.team_group_id
),
group_scope AS (
  SELECT gsa.*
  FROM group_scope_anchor gsa
),
roster_season_meta AS (
  SELECT
    gs.season,
    gs.roster_id,
    COUNT(DISTINCT gs.series_id)::INT AS series_played,
    MAX(gs.match_date) AS last_seen_date
  FROM group_scope gs
  WHERE gs.season IS NOT NULL
  GROUP BY gs.season, gs.roster_id
),
roster_starter_map AS (
  SELECT
    gs.season,
    gs.roster_id,
    starter_id,
    COUNT(DISTINCT gs.series_id)::INT AS series_appearances
  FROM group_scope gs
  CROSS JOIN LATERAL unnest(gs.starters) AS starter_id
  WHERE gs.season IS NOT NULL
  GROUP BY gs.season, gs.roster_id, starter_id
),
roster_starter_arrays AS (
  SELECT
    rsm.season,
    rsm.roster_id,
    ARRAY_AGG(rsm.starter_id ORDER BY rsm.starter_id) AS starter_ids
  FROM roster_starter_map rsm
  GROUP BY rsm.season, rsm.roster_id
),
roster_overlap AS (
  SELECT
    child.season,
    child.roster_id AS child_roster_id,
    anchor.roster_id AS anchor_roster_id,
    anchor.series_played AS anchor_series_played,
    anchor.last_seen_date AS anchor_last_seen_date,
    (
      SELECT COUNT(*)
      FROM unnest(child_arr.starter_ids) AS c(id)
      JOIN unnest(anchor_arr.starter_ids) AS a(id) ON a.id = c.id
    )::INT AS overlap_count
  FROM roster_season_meta child
  JOIN roster_starter_arrays child_arr
    ON child_arr.season = child.season
   AND child_arr.roster_id = child.roster_id
  JOIN roster_season_meta anchor
    ON anchor.season = child.season
  JOIN roster_starter_arrays anchor_arr
    ON anchor_arr.season = anchor.season
   AND anchor_arr.roster_id = anchor.roster_id
),
roster_merge_map AS (
  SELECT
    child.season,
    child.roster_id,
    COALESCE(
      (
        SELECT ro.anchor_roster_id
        FROM roster_overlap ro
        WHERE ro.season = child.season
          AND ro.child_roster_id = child.roster_id
          AND (
            ro.anchor_roster_id = child.roster_id
            OR (
              ro.anchor_series_played > child.series_played
              AND ro.overlap_count >= 2
            )
          )
        ORDER BY
          CASE
            WHEN ro.anchor_series_played > child.series_played
              AND ro.overlap_count >= 2 THEN 0
            ELSE 1
          END,
          ro.anchor_series_played DESC,
          ro.anchor_last_seen_date DESC NULLS LAST,
          ro.anchor_roster_id
        LIMIT 1
      ),
      child.roster_id
    ) AS iteration_roster_id
  FROM roster_season_meta child
),
scope_stats AS (
  SELECT
    s.series_id,
    s."Game Number" AS game_number,
    s."Victory" AS victory,
    COALESCE(s."Goals_All Zones", 0) AS goals,
    gs.match_date,
    gs.season,
    gs.split,
    gs.event,
    gs.stage,
    gs.round,
    gs.mode,
    gs.scope,
    gs.tier,
    gs.best_of,
    gs.team_label,
    rm.iteration_roster_id
  FROM stats s
  JOIN group_scope gs
    ON gs.series_id = s.series_id
   AND gs.team_norm = UPPER(TRIM(s."Team"))
  JOIN roster_merge_map rm
    ON rm.season = gs.season
   AND rm.roster_id = gs.roster_id
),
series_game_results AS (
  SELECT
    ss.series_id,
    ss.iteration_roster_id,
    ss.game_number,
    BOOL_OR(ss.victory) AS game_won
  FROM scope_stats ss
  GROUP BY ss.series_id, ss.iteration_roster_id, ss.game_number
),
series_summary AS (
  SELECT
    ss.series_id,
    ss.iteration_roster_id,
    MIN(ss.team_label) AS team_label,
    MIN(ss.match_date) AS first_date,
    MAX(ss.match_date) AS last_date,
    MIN(ss.season) AS season,
    MIN(ss.split) AS split,
    MIN(ss.event) AS event,
    MIN(ss.mode) AS mode,
    MIN(ss.scope) AS scope,
    MIN(ss.tier) AS tier,
    MAX(ss.best_of) AS best_of,
    (ARRAY_AGG(COALESCE(NULLIF(ss.round, ''), NULLIF(ss.stage, '')) ORDER BY
      CASE
        WHEN ss.round ILIKE '%GF 2%' OR ss.round ILIKE '%GF2%' THEN 900
        WHEN ss.round ILIKE '%GF 1%' OR ss.round ILIKE '%GF1%' OR ss.round ILIKE '%GF%' THEN 850
        WHEN ss.round ILIKE '%SF%' THEN 800
        WHEN ss.round ILIKE '%QF%' THEN 700
        WHEN ss.round ILIKE '%R16%' OR ss.round ILIKE '%16%' THEN 600
        WHEN ss.round ILIKE '%R32%' OR ss.round ILIKE '%32%' THEN 500
        WHEN ss.stage ILIKE '%Playoff%' THEN 400
        WHEN ss.stage ILIKE '%Swiss%' THEN 300
        ELSE 100
      END DESC,
      ss.match_date DESC NULLS LAST
    ))[1] AS stage_reached,
    MAX(
      CASE
        WHEN ss.round ILIKE '%GF 2%' OR ss.round ILIKE '%GF2%' THEN 900
        WHEN ss.round ILIKE '%GF 1%' OR ss.round ILIKE '%GF1%' OR ss.round ILIKE '%GF%' THEN 850
        WHEN ss.round ILIKE '%SF%' THEN 800
        WHEN ss.round ILIKE '%QF%' THEN 700
        WHEN ss.round ILIKE '%R16%' OR ss.round ILIKE '%16%' THEN 600
        WHEN ss.round ILIKE '%R32%' OR ss.round ILIKE '%32%' THEN 500
        WHEN ss.stage ILIKE '%Playoff%' THEN 400
        WHEN ss.stage ILIKE '%Swiss%' THEN 300
        ELSE 100
      END
    ) AS round_depth,
    BOOL_OR(ss.round ILIKE '%GF%') AS has_gf_round,
    BOOL_OR(ss.round ILIKE '%SF%') AS has_sf_round,
    BOOL_OR(ss.round ILIKE '%QF%') AS has_qf_round,
    BOOL_OR(ss.round ILIKE '%R16%' OR ss.round ILIKE '%16%') AS has_r16_round,
    BOOL_OR(ss.round ILIKE '%R32%' OR ss.round ILIKE '%32%') AS has_r32_round,
    BOOL_OR(ss.stage ILIKE '%Playoff%') AS has_playoff_stage,
    BOOL_OR(ss.stage ILIKE '%Swiss%') AS has_swiss_stage,
    COUNT(DISTINCT (ss.series_id, ss.game_number))::INT AS games_played,
    COUNT(DISTINCT (ss.series_id, ss.game_number)) FILTER (WHERE ss.victory = true)::INT AS games_won,
    COUNT(DISTINCT sgr.game_number) FILTER (WHERE sgr.game_won)::INT AS series_game_wins
  FROM scope_stats ss
  JOIN series_game_results sgr
    ON sgr.series_id = ss.series_id
   AND sgr.iteration_roster_id = ss.iteration_roster_id
   AND sgr.game_number = ss.game_number
  GROUP BY ss.series_id, ss.iteration_roster_id
),
event_rollup AS (
  SELECT
    ss.season,
    ss.split,
    ss.event,
    ss.mode,
    ss.scope,
    ss.tier,
    ss.iteration_roster_id,
    ARRAY_AGG(DISTINCT ss.team_label) FILTER (WHERE ss.team_label IS NOT NULL AND TRIM(ss.team_label) <> '') AS team_labels,
    MIN(ss.first_date) AS first_date,
    MAX(ss.last_date) AS last_date,
    COUNT(DISTINCT ss.series_id)::INT AS series_played,
    COUNT(DISTINCT ss.series_id) FILTER (
      WHERE ss.series_game_wins >= CEIL(COALESCE(ss.best_of, 0) / 2.0)
    )::INT AS series_won,
    SUM(ss.games_played)::INT AS games_played,
    SUM(ss.games_won)::INT AS games_won,
    (ARRAY_AGG(ss.stage_reached ORDER BY ss.round_depth DESC, ss.last_date DESC NULLS LAST))[1] AS stage_reached,
    BOOL_OR(
      ss.has_gf_round
      AND ss.series_game_wins >= CEIL(COALESCE(ss.best_of, 0) / 2.0)
    ) AS won_gf,
    BOOL_OR(ss.has_gf_round) AS has_gf_round,
    BOOL_OR(ss.has_sf_round) AS has_sf_round,
    BOOL_OR(ss.has_qf_round) AS has_qf_round,
    BOOL_OR(ss.has_r16_round) AS has_r16_round,
    BOOL_OR(ss.has_r32_round) AS has_r32_round,
    BOOL_OR(ss.has_playoff_stage) AS has_playoff_stage,
    BOOL_OR(ss.has_swiss_stage) AS has_swiss_stage
  FROM series_summary ss
  GROUP BY
    ss.season,
    ss.split,
    ss.event,
    ss.mode,
    ss.scope,
    ss.tier,
    ss.iteration_roster_id
),
player_handles AS (
  SELECT
    pid.player_key,
    COALESCE(MIN(p."Primary Handle"), MIN(s."Player Name")) AS handle
  FROM (
    SELECT DISTINCT starter_id AS player_key
    FROM roster_starter_map
  ) pid
  LEFT JOIN players p ON p."Unique ID" = pid.player_key
  LEFT JOIN stats s ON NULLIF(TRIM(s."Unique ID"), '') = pid.player_key
  GROUP BY pid.player_key
),
iteration_starters AS (
  SELECT
    rsm.season,
    rsm.roster_id,
    json_agg(
      json_build_object('id', rsm.starter_id, 'handle', ph.handle)
      ORDER BY COALESCE(ph.handle, rsm.starter_id), rsm.starter_id
    ) AS starters
  FROM roster_starter_map rsm
  LEFT JOIN player_handles ph ON ph.player_key = rsm.starter_id
  GROUP BY rsm.season, rsm.roster_id
)
SELECT
  md5(
    LOWER(TRIM(COALESCE(er.season, ''))) || '|' ||
    LOWER(TRIM(COALESCE(er.split, ''))) || '|' ||
    LOWER(TRIM(COALESCE(er.event, ''))) || '|' ||
    LOWER(TRIM(COALESCE(er.mode, ''))) || '|' ||
    LOWER(TRIM(COALESCE(er.scope, ''))) || '|' ||
    LOWER(TRIM(COALESCE(er.tier, '')))
  ) AS event_id,
  er.season,
  er.split,
  er.event,
  er.scope,
  er.tier,
  er.stage_reached,
  CASE
    WHEN er.scope = 'international' THEN NULL
    WHEN er.won_gf THEN 'Top 1'
    WHEN er.has_gf_round THEN 'Top 2'
    WHEN er.has_sf_round THEN 'Top 4'
    WHEN er.has_qf_round THEN 'Top 8'
    WHEN er.has_r16_round THEN 'Top 16'
    WHEN er.has_r32_round THEN 'Top 32'
    WHEN er.has_playoff_stage THEN 'Top 8'
    WHEN er.has_swiss_stage THEN 'Top 16'
    ELSE NULL
  END AS placement,
  er.series_played,
  er.series_won,
  er.games_played,
  er.games_won,
  er.first_date,
  er.last_date,
  er.iteration_roster_id AS roster_id,
  COALESCE(er.team_labels, ARRAY[]::text[]) AS team_labels,
  COALESCE(ist.starters, '[]'::json) AS roster_starters
FROM event_rollup er
LEFT JOIN iteration_starters ist
  ON ist.season = er.season
 AND ist.roster_id = er.iteration_roster_id
ORDER BY er.last_date DESC NULLS LAST, er.season DESC, er.split DESC, er.event DESC;
