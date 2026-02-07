-- Head-to-head history: show series where selected players appeared on opposing teams
-- Uses game-level winner reconstruction to handle bad/missing Victory flags.
WITH base AS (
  SELECT
    s.*,
    TRIM(s."Team") AS team,
    {{playerKeyExpr}} AS player_key
  FROM stats s
  {{where}}
),
valid_series AS (
  SELECT series_id
  FROM base
  GROUP BY series_id
  HAVING COUNT(DISTINCT team) = 2
),
h2h_series AS (
  SELECT DISTINCT
    a.series_id,
    a."Date"::date AS match_date,
    a."Round",
    a."Stage",
    a."Season",
    a."Split",
    a."Regional",
    MAX(a."Best of ") OVER (PARTITION BY a.series_id) AS best_of,
    LEAST(a.team, b.team) AS team_a,
    GREATEST(a.team, b.team) AS team_b
  FROM base a
  JOIN valid_series v ON v.series_id = a.series_id
  JOIN base b
    ON b.series_id = a.series_id
    AND b.team != a.team
    AND b.player_key = ANY({{idsParam}})
    AND b.player_key != a.player_key
  WHERE a.player_key = ANY({{idsParam}})
),
game_team_results AS (
  SELECT
    base.series_id,
    base."Game Number" AS game_number,
    base.team,
    bool_or(base."Victory") AS team_won,
    SUM(COALESCE(base."Goals_All Zones", 0)) AS team_goals,
    MAX(base."Best of ") AS best_of
  FROM base
  JOIN h2h_series h
    ON base.series_id = h.series_id
    AND base.team IN (h.team_a, h.team_b)
  GROUP BY base.series_id, base."Game Number", base.team
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
    h."Regional",
    h.team_a,
    h.team_b,
    COUNT(*) FILTER (WHERE gw.winner_team = h.team_a) AS team_a_wins,
    COUNT(*) FILTER (WHERE gw.winner_team = h.team_b) AS team_b_wins,
    COALESCE(MAX(gw.best_of), MAX(h.best_of)) AS best_of
  FROM h2h_series h
  LEFT JOIN game_winners gw
    ON gw.series_id = h.series_id
  GROUP BY h.series_id, h.match_date, h."Round", h."Stage", h."Season", h."Split", h."Regional", h.team_a, h.team_b
),
series_entities AS (
  SELECT
    base.series_id,
    base.team,
    ARRAY_AGG(DISTINCT base.player_key ORDER BY base.player_key) AS entity_ids
  FROM base
  JOIN h2h_series h
    ON base.series_id = h.series_id
    AND base.team IN (h.team_a, h.team_b)
  WHERE base.player_key = ANY({{idsParam}})
  GROUP BY base.series_id, base.team
),
entity_labels AS (
  SELECT
    base.player_key AS id,
    COALESCE(MIN(p."Primary Handle"), MIN(base."Player Name")) AS label
  FROM base
  LEFT JOIN players p ON p."Player ID" = base.player_key
  WHERE base.player_key = ANY({{idsParam}})
  GROUP BY base.player_key
)
SELECT
  t.match_date AS date,
  t."Season" AS season,
  t."Split" AS split,
  t."Regional" AS regional,
  t."Stage" AS stage,
  t."Round" AS round,
  t.team_a,
  t.team_b,
  t.team_a_wins,
  t.team_b_wins,
  t.best_of,
  JSON_BUILD_ARRAY(
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
  ) AS teams
FROM totals t
LEFT JOIN series_entities se
  ON se.series_id = t.series_id
  AND se.team = t.team_a
LEFT JOIN series_entities se2
  ON se2.series_id = t.series_id
  AND se2.team = t.team_b
ORDER BY t.match_date DESC NULLS LAST;
