-- Head-to-head history for rosters: show series where rosters actually played each other
-- Uses game-level winner reconstruction to handle bad/missing Victory flags.
{{rosterCtes}},
filtered_base AS (
  SELECT * FROM base fb WHERE 1=1 {{filterClauses}}
),
valid_series AS (
  SELECT series_id
  FROM filtered_base
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
  FROM filtered_base a
  JOIN valid_series v ON v.series_id = a.series_id
  JOIN series_roster sra ON a.series_id = sra.series_id AND a.team = sra.team
  JOIN filtered_base b
    ON b.series_id = a.series_id
    AND b.team != a.team
  JOIN series_roster srb ON b.series_id = srb.series_id AND b.team = srb.team
  WHERE sra.roster_id = ANY({{idsParam}})
    AND srb.roster_id = ANY({{idsParam}})
    AND sra.roster_id != srb.roster_id
),
game_team_results AS (
  SELECT
    fb.series_id,
    fb."Game Number" AS game_number,
    fb.team,
    bool_or(fb."Victory") AS team_won,
    SUM(COALESCE(fb."Goals_All Zones", 0)) AS team_goals,
    MAX(fb."Best of ") AS best_of
  FROM filtered_base fb
  JOIN h2h_series h
    ON fb.series_id = h.series_id
    AND fb.team IN (h.team_a, h.team_b)
  GROUP BY fb.series_id, fb."Game Number", fb.team
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
    fb.series_id,
    sr.roster_id,
    fb.team
  FROM filtered_base fb
  JOIN series_roster sr ON fb.series_id = sr.series_id AND fb.team = sr.team
  JOIN h2h_series h
    ON fb.series_id = h.series_id
    AND fb.team IN (h.team_a, h.team_b)
  WHERE sr.roster_id = ANY({{idsParam}})
  GROUP BY fb.series_id, sr.roster_id, fb.team
),
series_entity_arrays AS (
  SELECT
    series_id,
    team,
    ARRAY_AGG(DISTINCT roster_id ORDER BY roster_id) AS entity_ids
  FROM series_entities
  GROUP BY series_id, team
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
            'label', rn.roster_name
          )
          ORDER BY rn.roster_name
        )
        FROM UNNEST(se.entity_ids) AS e(entity_id)
        LEFT JOIN roster_names rn ON rn.roster_id = e.entity_id
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
            'label', rn.roster_name
          )
          ORDER BY rn.roster_name
        )
        FROM UNNEST(se2.entity_ids) AS e(entity_id)
        LEFT JOIN roster_names rn ON rn.roster_id = e.entity_id
        WHERE se2.team = t.team_b
      )
    )
  ) AS teams
FROM totals t
LEFT JOIN series_entity_arrays se
  ON se.series_id = t.series_id
  AND se.team = t.team_a
LEFT JOIN series_entity_arrays se2
  ON se2.series_id = t.series_id
  AND se2.team = t.team_b
ORDER BY t.match_date DESC NULLS LAST;
