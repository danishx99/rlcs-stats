-- Head-to-head history: show series where selected players appeared on opposing teams
-- Uses game-level winner reconstruction to handle bad/missing Victory flags.
-- Player-first approach: starts from target players only, not all rows.
WITH player_rows AS (
  SELECT
    s.series_id,
    s."Date",
    s."Round",
    s."Stage",
    s."Season",
    s."Split",
    s."Event",
    s."mode",
    s."scope",
    s."tier",
    s."Best of ",
    s."Game Number",
    s."Victory",
    s."Goals_All Zones",
    s."Player Name",
    TRIM(s."Team") AS team,
    {{playerKeyExpr}} AS player_key
  FROM stats s
  WHERE {{playerKeyExpr}} = ANY({{idsParam}})
    {{filterClauses}}
),
h2h_series AS (
  SELECT DISTINCT
    a.series_id,
    a."Date"::date AS match_date,
    a."Round",
    a."Stage",
    a."Season",
    a."Split",
    a."Event",
    TRIM(a."mode") AS mode,
    TRIM(a."scope") AS scope,
    TRIM(a."tier") AS tier,
    MAX(a."Best of ") OVER (PARTITION BY a.series_id) AS best_of,
    LEAST(a.team, b.team) AS team_a,
    GREATEST(a.team, b.team) AS team_b
  FROM player_rows a
  JOIN player_rows b
    ON b.series_id = a.series_id
    AND b.team != a.team
    AND b.player_key != a.player_key
),
series_games AS (
  SELECT
    s.series_id,
    s."Game Number",
    TRIM(s."Team") AS team,
    s."Victory",
    COALESCE(s."Goals_All Zones", 0) AS goals,
    s."Best of "
  FROM stats s
  JOIN (SELECT DISTINCT series_id FROM h2h_series) h ON h.series_id = s.series_id
),
game_team_results AS (
  SELECT
    sg.series_id,
    sg."Game Number" AS game_number,
    sg.team,
    bool_or(sg."Victory") AS team_won,
    SUM(sg.goals) AS team_goals,
    MAX(sg."Best of ") AS best_of
  FROM series_games sg
  JOIN h2h_series h
    ON sg.series_id = h.series_id
    AND sg.team IN (h.team_a, h.team_b)
  GROUP BY sg.series_id, sg."Game Number", sg.team
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
    h.series_id,
    h.match_date,
    h."Round",
    h."Stage",
    h."Season",
    h."Split",
    h."Event",
    h.mode,
    h.scope,
    h.tier,
    h.team_a,
    h.team_b,
    COUNT(*) FILTER (WHERE gw.winner_team = h.team_a) AS team_a_wins,
    COUNT(*) FILTER (WHERE gw.winner_team = h.team_b) AS team_b_wins,
    COALESCE(MAX(gw.best_of), MAX(h.best_of)) AS best_of
  FROM h2h_series h
  LEFT JOIN game_winners gw
    ON gw.series_id = h.series_id
  GROUP BY
    h.series_id,
    h.match_date,
    h."Round",
    h."Stage",
    h."Season",
    h."Split",
    h."Event",
    h.mode,
    h.scope,
    h.tier,
    h.team_a,
    h.team_b
),
series_entities AS (
  SELECT
    pr.series_id,
    pr.team,
    ARRAY_AGG(DISTINCT pr.player_key ORDER BY pr.player_key) AS entity_ids
  FROM player_rows pr
  JOIN h2h_series h
    ON pr.series_id = h.series_id
    AND pr.team IN (h.team_a, h.team_b)
  GROUP BY pr.series_id, pr.team
),
entity_labels AS (
  SELECT
    pr.player_key AS id,
    COALESCE(MIN(p."Primary Handle"), MIN(pr."Player Name")) AS label
  FROM player_rows pr
  LEFT JOIN players p ON p."Unique ID" = pr.player_key
  GROUP BY pr.player_key
)
SELECT
  tc.total_count,
  t.series_id,
  t.match_date AS date,
  t."Season" AS season,
  t."Split" AS split,
  t."Event" AS event,
  md5(
    LOWER(TRIM(COALESCE(t."Season", ''))) || '|' ||
    LOWER(TRIM(COALESCE(t."Split", ''))) || '|' ||
    LOWER(TRIM(COALESCE(t."Event", ''))) || '|' ||
    LOWER(TRIM(COALESCE(t.mode, ''))) || '|' ||
    LOWER(TRIM(COALESCE(t.scope, ''))) || '|' ||
    LOWER(TRIM(COALESCE(t.tier, '')))
  ) AS event_id,
  t."Stage" AS stage,
  t."Round" AS round,
  t.team_a,
  t.team_b,
  t.team_a_wins,
  t.team_b_wins,
  t.best_of,
  CASE
    WHEN t.series_id IS NULL THEN NULL
    ELSE JSON_BUILD_ARRAY(
      JSON_BUILD_OBJECT(
        'team', t.team_a,
        'wins', t.team_a_wins,
        'entities', (
          SELECT JSON_AGG(
            JSON_BUILD_OBJECT(
              'id', e.entity_id,
              'label', l.label
            )
            ORDER BY l.label
          )
          FROM UNNEST(se.entity_ids) AS e(entity_id)
          JOIN entity_labels l ON l.id = e.entity_id
          WHERE se.team = t.team_a
        )
      ),
      JSON_BUILD_OBJECT(
        'team', t.team_b,
        'wins', t.team_b_wins,
        'entities', (
          SELECT JSON_AGG(
            JSON_BUILD_OBJECT(
              'id', e.entity_id,
              'label', l.label
            )
            ORDER BY l.label
          )
          FROM UNNEST(se2.entity_ids) AS e(entity_id)
          JOIN entity_labels l ON l.id = e.entity_id
          WHERE se2.team = t.team_b
        )
      )
    )
  END AS teams
FROM (
  SELECT COUNT(*)::INT AS total_count FROM totals
) tc
LEFT JOIN (
  SELECT *
  FROM totals
  ORDER BY match_date DESC NULLS LAST, series_id DESC
  LIMIT {{limitParam}}
  OFFSET {{offsetParam}}
) t ON TRUE
LEFT JOIN series_entities se
  ON se.series_id = t.series_id
  AND se.team = t.team_a
LEFT JOIN series_entities se2
  ON se2.series_id = t.series_id
  AND se2.team = t.team_b
ORDER BY t.match_date DESC NULLS LAST, t.series_id DESC;
