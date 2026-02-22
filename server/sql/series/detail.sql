WITH base AS (
  SELECT
    s.series_id,
    s."Date"::date AS match_date,
    TRIM(s."Season") AS season,
    TRIM(s."Split") AS split,
    TRIM(s."Event") AS event,
    TRIM(s."Stage") AS stage,
    TRIM(s."Round") AS round,
    s."Day" AS day,
    s."Best of " AS best_of,
    s."Game Number" AS game_number,
    TRIM(s."Match ID") AS match_id,
    UPPER(TRIM(s."Team")) AS team_norm,
    TRIM(s."Team") AS team_label,
    s."Victory" AS victory,
    COALESCE(s."Goals_All Zones", 0) AS goals
  FROM stats s
  WHERE s.series_id = {{seriesIdParam}}
    AND s."Team" IS NOT NULL
    AND TRIM(s."Team") <> ''
),
series_meta AS (
  SELECT
    b.series_id,
    MIN(b.match_date) AS date,
    MIN(NULLIF(b.season, '')) AS season,
    MIN(NULLIF(b.split, '')) AS split,
    MIN(NULLIF(b.event, '')) AS event,
    MIN(NULLIF(b.stage, '')) AS stage,
    MIN(NULLIF(b.round, '')) AS round,
    MIN(b.day) AS day,
    MAX(b.best_of) AS best_of,
    MIN(b.team_norm) AS team_a,
    MAX(b.team_norm) AS team_b
  FROM base b
  GROUP BY b.series_id
  HAVING COUNT(DISTINCT b.team_norm) = 2
),
series_team_labels AS (
  SELECT
    sm.series_id,
    MIN(b.team_label) FILTER (WHERE b.team_norm = sm.team_a) AS team_a_label,
    MIN(b.team_label) FILTER (WHERE b.team_norm = sm.team_b) AS team_b_label
  FROM series_meta sm
  JOIN base b ON b.series_id = sm.series_id
  GROUP BY sm.series_id
),
game_team_results AS (
  SELECT
    b.series_id,
    b.game_number,
    b.team_norm AS team,
    MIN(b.match_id) AS match_id,
    bool_or(b.victory) AS team_won,
    SUM(b.goals) AS team_goals,
    MAX(b.best_of) AS best_of
  FROM base b
  JOIN series_meta sm
    ON sm.series_id = b.series_id
    AND b.team_norm IN (sm.team_a, sm.team_b)
  WHERE b.game_number IS NOT NULL
  GROUP BY b.series_id, b.game_number, b.team_norm
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
series_totals AS (
  SELECT
    sm.series_id,
    sm.date,
    sm.season,
    sm.split,
    sm.event,
    sm.stage,
    sm.round,
    sm.day,
    COALESCE(MAX(gw.best_of), sm.best_of) AS best_of,
    sm.team_a,
    sm.team_b,
    COUNT(*) FILTER (WHERE gw.winner_team = sm.team_a) AS team_a_wins,
    COUNT(*) FILTER (WHERE gw.winner_team = sm.team_b) AS team_b_wins,
    COUNT(DISTINCT gw.game_number) AS games_recorded
  FROM series_meta sm
  LEFT JOIN game_winners gw ON gw.series_id = sm.series_id
  GROUP BY
    sm.series_id,
    sm.date,
    sm.season,
    sm.split,
    sm.event,
    sm.stage,
    sm.round,
    sm.day,
    sm.best_of,
    sm.team_a,
    sm.team_b
),
game_pivot AS (
  SELECT
    gw.series_id,
    gw.game_number,
    COALESCE(
      MAX(gtr.match_id) FILTER (WHERE gtr.team = sm.team_a),
      MAX(gtr.match_id) FILTER (WHERE gtr.team = sm.team_b)
    ) AS match_id,
    MAX(gtr.team_goals) FILTER (WHERE gtr.team = sm.team_a) AS team_a_goals,
    MAX(gtr.team_goals) FILTER (WHERE gtr.team = sm.team_b) AS team_b_goals,
    gw.winner_team
  FROM game_winners gw
  JOIN series_meta sm ON sm.series_id = gw.series_id
  LEFT JOIN game_team_results gtr
    ON gtr.series_id = gw.series_id
    AND gtr.game_number = gw.game_number
  GROUP BY gw.series_id, gw.game_number, gw.winner_team
),
games_json AS (
  SELECT
    gp.series_id,
    COALESCE(
      JSON_AGG(
        JSON_BUILD_OBJECT(
          'gameNumber', gp.game_number,
          'matchId', gp.match_id,
          'teamAGoals', gp.team_a_goals,
          'teamBGoals', gp.team_b_goals,
          'winnerTeam', gp.winner_team
        )
        ORDER BY gp.game_number
      ),
      '[]'::json
    ) AS games
  FROM game_pivot gp
  GROUP BY gp.series_id
)
SELECT
  st.series_id,
  st.date,
  st.season,
  st.split,
  st.event,
  st.stage,
  st.round,
  st.day,
  st.best_of,
  COALESCE(stl.team_a_label, st.team_a) AS team_a,
  COALESCE(stl.team_b_label, st.team_b) AS team_b,
  st.team_a_wins,
  st.team_b_wins,
  st.games_recorded,
  COALESCE(gj.games, '[]'::json) AS games
FROM series_totals st
LEFT JOIN games_json gj ON gj.series_id = st.series_id
LEFT JOIN series_team_labels stl ON stl.series_id = st.series_id;
