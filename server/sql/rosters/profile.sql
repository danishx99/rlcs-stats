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
    MIN(tp."Team Name") AS org_name,
    MIN(tp."Logo Link") AS logo_url
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
    MAX(NULLIF(TRIM(s."Regional"), '')) AS regional,
    MAX(NULLIF(TRIM(s."Stage"), '')) AS stage,
    MIN(NULLIF(TRIM(s."Round"), '')) AS round,
    MAX(COALESCE(s."Best of ", 0)) AS best_of
  FROM stats s
  WHERE s.series_id IS NOT NULL
    AND s."Team" IS NOT NULL
    AND TRIM(s."Team") <> ''
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
    sm.regional,
    sm.stage,
    sm.round,
    sm.best_of,
    sr.roster_id,
    sr.starters,
    tpn.org_name,
    tpn.logo_url,
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
scope_stats AS (
  SELECT
    s.*,
    NULLIF(TRIM(s."Unique ID"), '') AS player_key,
    gs.roster_id,
    gs.season,
    gs.split,
    gs.regional,
    gs.stage,
    gs.round,
    gs.best_of,
    gs.match_date,
    gs.team_label
  FROM stats s
  JOIN group_scope gs
    ON gs.series_id = s.series_id
   AND gs.team_norm = UPPER(TRIM(s."Team"))
),
group_identity AS (
  SELECT
    p.team_group_id,
    COALESCE(
      MIN(gs.org_name),
      (
        SELECT gs2.team_label
        FROM group_scope gs2
        ORDER BY gs2.match_date DESC NULLS LAST, gs2.team_label
        LIMIT 1
      )
    ) AS team_name,
    COALESCE(
      MIN(gs.logo_url),
      (
        SELECT tp."Logo Link"
        FROM group_scope gs2
        JOIN team_profiles tp
          ON UPPER(TRIM(tp."Team Name")) = UPPER(TRIM(gs2.team_label))
        ORDER BY gs2.match_date DESC NULLS LAST
        LIMIT 1
      )
    ) AS logo_url
  FROM params p
  LEFT JOIN group_scope gs ON true
  GROUP BY p.team_group_id
),
first_appearance AS (
  SELECT
    gs.season AS debut_season,
    gs.split AS debut_split,
    gs.regional AS debut_event
  FROM group_scope gs
  ORDER BY gs.match_date ASC NULLS LAST, gs.season ASC, gs.split ASC, gs.regional ASC
  LIMIT 1
),
series_summary AS (
  SELECT
    ss.series_id,
    MAX(ss.season) AS season,
    MAX(ss.split) AS split,
    MAX(ss.regional) AS regional,
    MAX(ss.stage) AS stage,
    MIN(ss.round) AS round,
    MAX(ss.best_of) AS best_of,
    COUNT(DISTINCT CASE WHEN ss."Victory" = true THEN ss."Game Number" END) AS wins
  FROM scope_stats ss
  GROUP BY ss.series_id
),
series_winners AS (
  SELECT
    ssum.*,
    ssum.wins >= CEIL(COALESCE(ssum.best_of, 0) / 2.0) AS won_series
  FROM series_summary ssum
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
default_season AS (
  SELECT gs.season
  FROM group_scope gs
  WHERE gs.season IS NOT NULL
  GROUP BY gs.season
  ORDER BY gs.season DESC
  LIMIT 1
),
roster_season_meta AS (
  SELECT
    gs.season,
    gs.roster_id,
    (ARRAY_AGG(gs.team_label ORDER BY gs.match_date DESC NULLS LAST, gs.team_label))[1] AS team_label_used,
    COUNT(DISTINCT gs.series_id)::INT AS series_played,
    MIN(gs.match_date) AS first_seen_date,
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
iteration_season_meta AS (
  SELECT
    rm.season,
    rm.iteration_roster_id AS roster_id,
    (ARRAY_AGG(rsm.team_label_used ORDER BY rsm.last_seen_date DESC NULLS LAST, rsm.team_label_used))[1] AS team_label_used,
    SUM(rsm.series_played)::INT AS series_played,
    MIN(rsm.first_seen_date) AS first_seen_date,
    MAX(rsm.last_seen_date) AS last_seen_date
  FROM roster_merge_map rm
  JOIN roster_season_meta rsm
    ON rsm.season = rm.season
   AND rsm.roster_id = rm.roster_id
  GROUP BY rm.season, rm.iteration_roster_id
),
primary_starters AS (
  SELECT
    ism.season,
    ism.roster_id AS iteration_roster_id,
    rsm.starter_id
  FROM iteration_season_meta ism
  JOIN roster_starter_map rsm
    ON rsm.season = ism.season
   AND rsm.roster_id = ism.roster_id
),
player_handles AS (
  SELECT
    rpm.player_key,
    COALESCE(MIN(p."Primary Handle"), MIN(ss."Player Name")) AS handle
  FROM (
    SELECT DISTINCT starter_id AS player_key
    FROM roster_starter_map
  ) rpm
  LEFT JOIN players p ON p."Player ID" = rpm.player_key
  LEFT JOIN scope_stats ss ON ss.player_key = rpm.player_key
  GROUP BY rpm.player_key
),
starter_profiles AS (
  SELECT
    ism.season,
    ism.roster_id AS iteration_roster_id,
    ps.starter_id,
    ph.handle
  FROM iteration_season_meta ism
  JOIN primary_starters ps
    ON ps.season = ism.season
   AND ps.iteration_roster_id = ism.roster_id
  LEFT JOIN player_handles ph ON ph.player_key = ps.starter_id
),
alternate_profiles AS (
  SELECT
    rm.season,
    rm.iteration_roster_id,
    rsm.starter_id AS alt_id,
    SUM(rsm.series_appearances)::INT AS appearances,
    ph.handle
  FROM roster_merge_map rm
  JOIN roster_starter_map rsm
    ON rsm.season = rm.season
   AND rsm.roster_id = rm.roster_id
  LEFT JOIN primary_starters ps
    ON ps.season = rm.season
   AND ps.iteration_roster_id = rm.iteration_roster_id
   AND ps.starter_id = rsm.starter_id
  LEFT JOIN player_handles ph ON ph.player_key = rsm.starter_id
  WHERE ps.starter_id IS NULL
  GROUP BY rm.season, rm.iteration_roster_id, rsm.starter_id, ph.handle
),
iteration_rows AS (
  SELECT
    ism.season,
    ism.roster_id,
    ism.team_label_used,
    ism.series_played,
    ism.first_seen_date,
    ism.last_seen_date,
    COALESCE((
      SELECT json_agg(
        json_build_object('id', sp.starter_id, 'handle', sp.handle)
        ORDER BY COALESCE(sp.handle, sp.starter_id), sp.starter_id
      )
      FROM starter_profiles sp
      WHERE sp.season = ism.season
        AND sp.iteration_roster_id = ism.roster_id
    ), '[]'::json) AS starters,
    COALESCE((
      SELECT json_agg(
        json_build_object('id', ap.alt_id, 'handle', ap.handle, 'appearances', ap.appearances)
        ORDER BY ap.appearances DESC, COALESCE(ap.handle, ap.alt_id), ap.alt_id
      )
      FROM alternate_profiles ap
      WHERE ap.season = ism.season
        AND ap.iteration_roster_id = ism.roster_id
    ), '[]'::json) AS alternates
  FROM iteration_season_meta ism
),
season_rosters AS (
  SELECT
    ir.season,
    json_agg(
      json_build_object(
        'rosterId', ir.roster_id,
        'teamLabelUsed', ir.team_label_used,
        'seriesPlayed', ir.series_played,
        'firstSeenDate', ir.first_seen_date,
        'lastSeenDate', ir.last_seen_date,
        'starters', ir.starters,
        'alternates', ir.alternates
      )
      ORDER BY ir.series_played DESC, ir.last_seen_date DESC NULLS LAST, ir.roster_id
    ) AS iterations
  FROM iteration_rows ir
  GROUP BY ir.season
),
current_iteration AS (
  SELECT ir.*
  FROM iteration_rows ir
  JOIN default_season ds ON ds.season = ir.season
  ORDER BY ir.series_played DESC, ir.last_seen_date DESC NULLS LAST, ir.roster_id
  LIMIT 1
)
SELECT
  gi.team_group_id AS roster_id,
  gi.team_name AS roster_name,
  gi.logo_url,
  COALESCE((SELECT ci.starters FROM current_iteration ci), '[]'::json) AS starters,
  COALESCE((SELECT ci.alternates FROM current_iteration ci), '[]'::json) AS alternates,
  (SELECT debut_season FROM first_appearance) AS debut_season,
  (SELECT debut_split FROM first_appearance) AS debut_split,
  (SELECT debut_event FROM first_appearance) AS debut_event,
  (SELECT placement FROM best_result) AS best_result,
  COALESCE((SELECT ds.season FROM default_season ds), NULL) AS default_season,
  COALESCE((
    SELECT array_agg(season ORDER BY season DESC)
    FROM (
      SELECT DISTINCT gs.season AS season
      FROM group_scope gs
      WHERE gs.season IS NOT NULL
    ) seasons
  ), ARRAY[]::text[]) AS seasons_competed,
  COALESCE((
    SELECT array_agg(name ORDER BY name)
    FROM (
      SELECT DISTINCT gs.team_label AS name
      FROM group_scope gs
      JOIN group_identity gi2 ON true
      WHERE UPPER(TRIM(gs.team_label)) <> UPPER(TRIM(gi2.team_name))
    ) aliases
  ), ARRAY[]::text[]) AS other_team_names,
  COALESCE((
    SELECT json_agg(
      json_build_object('season', sr.season, 'iterations', sr.iterations)
      ORDER BY sr.season DESC
    )
    FROM season_rosters sr
  ), '[]'::json) AS season_rosters,
  COUNT(DISTINCT (scope_stats.series_id, scope_stats."Game")) AS games,
  COUNT(DISTINCT scope_stats.series_id) AS series_played,
  SUM(scope_stats."Goals_All Zones") AS goals_total,
  SUM(scope_stats."Goals_All Zones")::float / NULLIF(COUNT(DISTINCT (scope_stats.series_id, scope_stats."Game")), 0) AS goals_avg,
  SUM(scope_stats."Assists_All Zones") AS assists_total,
  SUM(scope_stats."Assists_All Zones")::float / NULLIF(COUNT(DISTINCT (scope_stats.series_id, scope_stats."Game")), 0) AS assists_avg,
  SUM(scope_stats."Saves_All Zones") AS saves_total,
  SUM(scope_stats."Saves_All Zones")::float / NULLIF(COUNT(DISTINCT (scope_stats.series_id, scope_stats."Game")), 0) AS saves_avg,
  SUM(scope_stats."Kills_All Zones") AS demos_total,
  SUM(scope_stats."Kills_All Zones")::float / NULLIF(COUNT(DISTINCT (scope_stats.series_id, scope_stats."Game")), 0) AS demos_avg
FROM group_identity gi
LEFT JOIN scope_stats ON true
GROUP BY gi.team_group_id, gi.team_name, gi.logo_url;
