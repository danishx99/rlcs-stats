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
    MIN(tp."Team Name") AS org_name,
    MIN(tp."Logo Link") AS logo_url,
    MIN(tp."Twitter") AS twitter,
    MIN(tp."TikTok") AS tiktok,
    MIN(tp."Youtube") AS youtube,
    MIN(tp."Twitch") AS twitch
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
    sm.scope,
    sm.tier,
    sm.best_of,
    sr.roster_id,
    sr.starters,
    tpn.org_name,
    tpn.logo_url,
    tpn.twitter,
    tpn.tiktok,
    tpn.youtube,
    tpn.twitch,
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
scope_stats AS (
  SELECT
    s.*,
    NULLIF(TRIM(s."Unique ID"), '') AS player_key,
    gs.roster_id,
    gs.season,
    gs.split,
    gs.event,
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
      CASE
        WHEN p.is_org THEN (
          SELECT COALESCE(tpn.org_name, p.requested_org_norm)
          FROM team_profiles_norm tpn
          WHERE tpn.team_norm = p.requested_org_norm
          LIMIT 1
        )
        ELSE NULL
      END,
      MIN(gs.org_name),
      (
        SELECT gs2.team_label
        FROM group_scope gs2
        ORDER BY gs2.match_date DESC NULLS LAST, gs2.team_label
        LIMIT 1
      )
    ) AS team_name,
    COALESCE(
      CASE
        WHEN p.is_org THEN (
          SELECT tpn.logo_url
          FROM team_profiles_norm tpn
          WHERE tpn.team_norm = p.requested_org_norm
          LIMIT 1
        )
        ELSE NULL
      END,
      MIN(gs.logo_url),
      (
        SELECT tp."Logo Link"
        FROM group_scope gs2
        JOIN team_profiles tp
          ON UPPER(TRIM(tp."Team Name")) = UPPER(TRIM(gs2.team_label))
        ORDER BY gs2.match_date DESC NULLS LAST
        LIMIT 1
      )
    ) AS logo_url,
    COALESCE(
      CASE
        WHEN p.is_org THEN (
          SELECT tpn.twitter
          FROM team_profiles_norm tpn
          WHERE tpn.team_norm = p.requested_org_norm
          LIMIT 1
        )
        ELSE NULL
      END,
      MIN(gs.twitter)
    ) AS twitter,
    COALESCE(
      CASE
        WHEN p.is_org THEN (
          SELECT tpn.tiktok
          FROM team_profiles_norm tpn
          WHERE tpn.team_norm = p.requested_org_norm
          LIMIT 1
        )
        ELSE NULL
      END,
      MIN(gs.tiktok)
    ) AS tiktok,
    COALESCE(
      CASE
        WHEN p.is_org THEN (
          SELECT tpn.youtube
          FROM team_profiles_norm tpn
          WHERE tpn.team_norm = p.requested_org_norm
          LIMIT 1
        )
        ELSE NULL
      END,
      MIN(gs.youtube)
    ) AS youtube,
    COALESCE(
      CASE
        WHEN p.is_org THEN (
          SELECT tpn.twitch
          FROM team_profiles_norm tpn
          WHERE tpn.team_norm = p.requested_org_norm
          LIMIT 1
        )
        ELSE NULL
      END,
      MIN(gs.twitch)
    ) AS twitch
  FROM params p
  LEFT JOIN group_scope gs ON true
  GROUP BY p.team_group_id, p.is_org, p.requested_org_norm
),
first_appearance AS (
  SELECT
    gs.season AS debut_season,
    gs.split AS debut_split,
    gs.event AS debut_event
  FROM group_scope gs
  ORDER BY gs.match_date ASC NULLS LAST, gs.season ASC, gs.split ASC, gs.event ASC
  LIMIT 1
),
roster_events AS (
  SELECT DISTINCT
    gs.season,
    gs.split,
    gs.event
  FROM group_scope gs
  WHERE gs.season IS NOT NULL
    AND gs.event IS NOT NULL
    AND COALESCE(gs.scope, '') <> 'international'
),
event_all_stats AS (
  SELECT s.*
  FROM stats s
  JOIN roster_events re
    ON TRIM(s."Season") IS NOT DISTINCT FROM re.season
   AND TRIM(s."Split") IS NOT DISTINCT FROM re.split
   AND TRIM(s."Event") IS NOT DISTINCT FROM re.event
  WHERE s.series_id IS NOT NULL
    AND s."Team" IS NOT NULL
    AND TRIM(s."Team") <> ''
),
event_has_playoffs AS (
  SELECT
    TRIM("Season") AS season,
    TRIM("Split") AS split,
    TRIM("Event") AS event,
    BOOL_OR(LOWER(TRIM("Stage")) LIKE '%playoff%') AS has_playoffs
  FROM event_all_stats
  GROUP BY TRIM("Season"), TRIM("Split"), TRIM("Event")
),
event_scoped AS (
  SELECT eas.*
  FROM event_all_stats eas
  JOIN event_has_playoffs ehp
    ON TRIM(eas."Season") IS NOT DISTINCT FROM ehp.season
   AND TRIM(eas."Split") IS NOT DISTINCT FROM ehp.split
   AND TRIM(eas."Event") IS NOT DISTINCT FROM ehp.event
  WHERE (ehp.has_playoffs AND LOWER(TRIM(eas."Stage")) LIKE '%playoff%')
     OR (NOT ehp.has_playoffs)
),
event_team_rounds AS (
  SELECT
    TRIM("Season") AS season,
    TRIM("Split") AS split,
    TRIM("Event") AS event,
    UPPER(TRIM("Team")) AS team_norm,
    UPPER(TRIM("Round")) AS rnd,
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
    rnd AS deep_round,
    depth AS round_depth,
    won_round AS won_deepest
  FROM event_team_rounds
  ORDER BY season, split, event, team_norm, depth DESC
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
roster_team_norms AS (
  SELECT DISTINCT UPPER(TRIM(gs.team_label)) AS team_norm
  FROM group_scope gs
  WHERE gs.team_label IS NOT NULL
    AND TRIM(gs.team_label) <> ''
),
best_result AS (
  SELECT
    CASE
      WHEN MIN(etp.placement_end) FILTER (WHERE etp.placement_end < 999) IS NULL THEN NULL
      ELSE CONCAT('Top ', MIN(etp.placement_end) FILTER (WHERE etp.placement_end < 999)::text)
    END AS placement
  FROM event_team_placements etp
  JOIN roster_team_norms rtn ON rtn.team_norm = etp.team_norm
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
    (ARRAY_AGG(gs.team_label ORDER BY gs.match_date DESC NULLS LAST, gs.team_label))[1] AS team_label_used,
    ARRAY_AGG(DISTINCT gs.team_label ORDER BY gs.team_label) AS team_names,
    COUNT(DISTINCT gs.series_id)::INT AS series_played,
    MIN(gs.match_date) AS first_seen_date,
    MAX(gs.match_date) AS last_seen_date
  FROM roster_merge_map rm
  JOIN group_scope gs
    ON gs.season = rm.season
   AND gs.roster_id = rm.roster_id
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
ssa_iterations AS (
  SELECT season, iteration_roster_id
  FROM primary_starters
  GROUP BY season, iteration_roster_id
  HAVING BOOL_AND(starter_id LIKE 'SSA-%')
),
player_handles AS (
  SELECT
    rpm.player_key,
    COALESCE(MIN(p."Primary Handle"), MIN(ss."Player Name")) AS handle
  FROM (
    SELECT DISTINCT starter_id AS player_key
    FROM roster_starter_map
  ) rpm
  LEFT JOIN players p ON p."Unique ID" = rpm.player_key
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
iteration_event_rows AS (
  SELECT
    rm.season,
    rm.iteration_roster_id AS roster_id,
    gs.split,
    gs.event,
    gs.scope,
    gs.tier,
    MIN(gs.match_date) AS first_date,
    MAX(gs.match_date) AS last_date
  FROM roster_merge_map rm
  JOIN group_scope gs
    ON gs.season = rm.season
   AND gs.roster_id = rm.roster_id
  GROUP BY rm.season, rm.iteration_roster_id, gs.split, gs.event, gs.scope, gs.tier
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
    ), '[]'::json) AS alternates,
    COALESCE((
      SELECT json_agg(
        json_build_object(
          'split', ier.split,
          'event', ier.event,
          'scope', ier.scope,
          'tier', ier.tier,
          'firstDate', ier.first_date,
          'lastDate', ier.last_date
        )
        ORDER BY ier.last_date DESC NULLS LAST, ier.split DESC, ier.event DESC
      )
      FROM iteration_event_rows ier
      WHERE ier.season = ism.season
        AND ier.roster_id = ism.roster_id
    ), '[]'::json) AS events
  FROM iteration_season_meta ism
  JOIN ssa_iterations si
    ON si.season = ism.season
   AND si.iteration_roster_id = ism.roster_id
),
default_season AS (
  SELECT ir.season
  FROM iteration_rows ir
  WHERE ir.season IS NOT NULL
  ORDER BY ir.season DESC
  LIMIT 1
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
        'alternates', ir.alternates,
        'events', ir.events
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
  gi.twitter,
  gi.tiktok,
  gi.youtube,
  gi.twitch,
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
      SELECT DISTINCT ir.season AS season
      FROM iteration_rows ir
      WHERE ir.season IS NOT NULL
    ) seasons
  ), ARRAY[]::text[]) AS seasons_competed,
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
GROUP BY gi.team_group_id, gi.team_name, gi.logo_url, gi.twitter, gi.tiktok, gi.youtube, gi.twitch;
