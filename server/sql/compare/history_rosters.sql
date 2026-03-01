-- Head-to-head history for rosters: show series where selected rosters actually played each other.
-- Uses persisted series_roster table + game-level winner reconstruction.
WITH target_rosters AS (
  SELECT
    sr.series_id,
    sr.team,
    sr.roster_id
  FROM series_roster sr
  WHERE sr.roster_id = ANY({{idsParam}})
),
valid_series AS (
  SELECT
    sr.series_id
  FROM series_roster sr
  GROUP BY sr.series_id
  HAVING COUNT(*) = 2
),
h2h_series AS (
  SELECT DISTINCT
    a.series_id,
    LEAST(a.team, b.team) AS team_a,
    GREATEST(a.team, b.team) AS team_b
  FROM target_rosters a
  JOIN target_rosters b
    ON b.series_id = a.series_id
    AND b.team <> a.team
    AND b.roster_id <> a.roster_id
  JOIN valid_series v
    ON v.series_id = a.series_id
),
series_meta AS (
  SELECT
    h.series_id,
    MIN(s."Date")::date AS match_date,
    MIN(s."Round") AS "Round",
    MIN(s."Stage") AS "Stage",
    MIN(s."Season") AS "Season",
    MIN(s."Split") AS "Split",
    MIN(s."Event") AS "Event",
    MIN(NULLIF(TRIM(s."mode"), '')) AS mode,
    MIN(NULLIF(TRIM(s."scope"), '')) AS scope,
    MIN(NULLIF(TRIM(s."tier"), '')) AS tier,
    MAX(s."Best of ") AS best_of,
    h.team_a,
    h.team_b
  FROM h2h_series h
  JOIN stats s ON s.series_id = h.series_id
  WHERE 1=1 {{filterClauses}}
  GROUP BY h.series_id, h.team_a, h.team_b
),
game_team_results AS (
  SELECT
    sm.series_id,
    s."Game Number" AS game_number,
    TRIM(s."Team") AS team,
    bool_or(s."Victory") AS team_won,
    SUM(COALESCE(s."Goals_All Zones", 0)) AS team_goals,
    MAX(s."Best of ") AS best_of
  FROM series_meta sm
  JOIN stats s ON s.series_id = sm.series_id
  WHERE TRIM(s."Team") IN (sm.team_a, sm.team_b)
  GROUP BY sm.series_id, s."Game Number", TRIM(s."Team")
),
game_outcomes AS (
  SELECT
    gtr.series_id,
    gtr.game_number,
    MAX(gtr.best_of) AS best_of,
    COUNT(*) AS team_count,
    SUM(CASE WHEN gtr.team_won THEN 1 ELSE 0 END) AS winner_flags,
    MAX(gtr.team_goals) AS max_goals,
    MIN(gtr.team_goals) AS min_goals,
    MAX(gtr.team) FILTER (WHERE gtr.team_won) AS flagged_winner_team
  FROM game_team_results gtr
  GROUP BY gtr.series_id, gtr.game_number
),
goal_winners AS (
  SELECT
    gtr.series_id,
    gtr.game_number,
    MAX(gtr.team) AS goal_winner_team
  FROM game_team_results gtr
  JOIN game_outcomes go
    ON go.series_id = gtr.series_id
    AND go.game_number = gtr.game_number
  WHERE gtr.team_goals = go.max_goals
  GROUP BY gtr.series_id, gtr.game_number
  HAVING COUNT(*) = 1
),
game_winners AS (
  SELECT
    go.series_id,
    go.game_number,
    go.best_of,
    CASE
      WHEN go.team_count <> 2 THEN NULL
      WHEN go.winner_flags = 1 THEN go.flagged_winner_team
      WHEN go.winner_flags = 0 AND go.max_goals <> go.min_goals THEN gw.goal_winner_team
      ELSE NULL
    END AS winner_team
  FROM game_outcomes go
  LEFT JOIN goal_winners gw
    ON gw.series_id = go.series_id
    AND gw.game_number = go.game_number
),
totals AS (
  SELECT
    sm.series_id,
    sm.match_date,
    sm."Round",
    sm."Stage",
    sm."Season",
    sm."Split",
    sm."Event",
    sm.mode,
    sm.scope,
    sm.tier,
    sm.team_a,
    sm.team_b,
    COUNT(*) FILTER (WHERE gw.winner_team = sm.team_a) AS team_a_wins,
    COUNT(*) FILTER (WHERE gw.winner_team = sm.team_b) AS team_b_wins,
    COALESCE(MAX(gw.best_of), MAX(sm.best_of)) AS best_of
  FROM series_meta sm
  LEFT JOIN game_winners gw ON gw.series_id = sm.series_id
  GROUP BY
    sm.series_id,
    sm.match_date,
    sm."Round",
    sm."Stage",
    sm."Season",
    sm."Split",
    sm."Event",
    sm.mode,
    sm.scope,
    sm.tier,
    sm.team_a,
    sm.team_b
),
series_entities AS (
  SELECT
    sm.series_id,
    sr.team,
    ARRAY_AGG(sr.roster_id ORDER BY sr.roster_id) AS entity_ids
  FROM series_meta sm
  JOIN series_roster sr
    ON sr.series_id = sm.series_id
    AND sr.team IN (sm.team_a, sm.team_b)
    AND sr.roster_id = ANY({{idsParam}})
  GROUP BY sm.series_id, sr.team
),
roster_name_counts AS (
  SELECT
    sr.roster_id,
    sr.team,
    COUNT(*) AS series_count
  FROM series_roster sr
  GROUP BY sr.roster_id, sr.team
),
roster_names AS (
  SELECT DISTINCT ON (rnc.roster_id)
    rnc.roster_id,
    rnc.team AS roster_name
  FROM roster_name_counts rnc
  ORDER BY rnc.roster_id, rnc.series_count DESC, rnc.team
),
total_count AS (
  SELECT COUNT(*)::INT AS total_count FROM totals
),
paged_totals AS (
  SELECT *
  FROM totals t
  ORDER BY t.match_date DESC NULLS LAST, t.series_id DESC
  LIMIT {{limitParam}}
  OFFSET {{offsetParam}}
)
SELECT
  tc.total_count,
  p.series_id,
  p.match_date AS date,
  p."Season" AS season,
  p."Split" AS split,
  p."Event" AS event,
  md5(
    LOWER(TRIM(COALESCE(p."Season", ''))) || '|' ||
    LOWER(TRIM(COALESCE(p."Split", ''))) || '|' ||
    LOWER(TRIM(COALESCE(p."Event", ''))) || '|' ||
    LOWER(TRIM(COALESCE(p.mode, ''))) || '|' ||
    LOWER(TRIM(COALESCE(p.scope, ''))) || '|' ||
    LOWER(TRIM(COALESCE(p.tier, '')))
  ) AS event_id,
  p."Stage" AS stage,
  p."Round" AS round,
  p.team_a,
  p.team_b,
  p.team_a_wins,
  p.team_b_wins,
  p.best_of,
  CASE
    WHEN p.series_id IS NULL THEN NULL
    ELSE JSON_BUILD_ARRAY(
      JSON_BUILD_OBJECT(
        'team', p.team_a,
        'wins', p.team_a_wins,
        'bestOf', p.best_of,
        'entities', (
          SELECT JSON_AGG(
            JSON_BUILD_OBJECT(
              'id', e.entity_id,
              'label', rn.roster_name
            )
            ORDER BY rn.roster_name
          )
          FROM series_entities se
          JOIN UNNEST(se.entity_ids) AS e(entity_id) ON TRUE
          LEFT JOIN roster_names rn ON rn.roster_id = e.entity_id
          WHERE se.series_id = p.series_id
            AND se.team = p.team_a
        )
      ),
      JSON_BUILD_OBJECT(
        'team', p.team_b,
        'wins', p.team_b_wins,
        'bestOf', p.best_of,
        'entities', (
          SELECT JSON_AGG(
            JSON_BUILD_OBJECT(
              'id', e.entity_id,
              'label', rn.roster_name
            )
            ORDER BY rn.roster_name
          )
          FROM series_entities se2
          JOIN UNNEST(se2.entity_ids) AS e(entity_id) ON TRUE
          LEFT JOIN roster_names rn ON rn.roster_id = e.entity_id
          WHERE se2.series_id = p.series_id
            AND se2.team = p.team_b
        )
      )
    )
  END AS teams
FROM total_count tc
LEFT JOIN paged_totals p ON TRUE
ORDER BY p.match_date DESC NULLS LAST, p.series_id DESC;
