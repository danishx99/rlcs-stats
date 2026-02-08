WITH base AS (
  SELECT
    s.series_id,
    s."Date"::date AS match_date,
    TRIM(s."Season") AS season,
    TRIM(s."Split") AS split,
    TRIM(s."Regional") AS regional,
    TRIM(s."Stage") AS stage,
    TRIM(s."Round") AS round,
    s."Day" AS day,
    s."Best of " AS best_of,
    s."Game Number" AS game_number,
    UPPER(TRIM(s."Team")) AS team_norm,
    TRIM(s."Team") AS team_label,
    s."Victory" AS victory,
    COALESCE(s."Goals_All Zones", 0) AS goals
  FROM stats s
  WHERE s.series_id IS NOT NULL
    AND s."Team" IS NOT NULL
    AND TRIM(s."Team") <> ''
    {{where}}
),
series_meta AS (
  SELECT
    b.series_id,
    MIN(b.match_date) AS date,
    MIN(NULLIF(b.season, '')) AS season,
    MIN(NULLIF(b.split, '')) AS split,
    MIN(NULLIF(b.regional, '')) AS regional,
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
    sm.regional,
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
    sm.regional,
    sm.stage,
    sm.round,
    sm.day,
    sm.best_of,
    sm.team_a,
    sm.team_b
)
SELECT
  st.series_id,
  st.date,
  st.season,
  st.split,
  st.regional,
  st.stage,
  st.round,
  st.day,
  st.best_of,
  COALESCE(stl.team_a_label, st.team_a) AS team_a,
  COALESCE(stl.team_b_label, st.team_b) AS team_b,
  st.team_a_wins,
  st.team_b_wins,
  st.games_recorded
FROM series_totals st
LEFT JOIN series_team_labels stl ON stl.series_id = st.series_id
{{seriesWhere}}
ORDER BY st.date DESC NULLS LAST, st.series_id DESC;
