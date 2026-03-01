WITH roster_teams AS (
  SELECT UPPER(TRIM(team_name)) AS team_norm
  FROM unnest($7::text[]) AS team_name
  WHERE team_name IS NOT NULL
    AND TRIM(team_name) <> ''
),
base_scope AS (
  SELECT
    s.series_id,
    s."Game Number" AS game_number,
    TRIM(s."Team") AS team,
    UPPER(TRIM(s."Team")) AS team_norm,
    s."Victory" AS victory,
    s."Best of " AS best_of,
    s."Date" AS match_date,
    UPPER(TRIM(COALESCE(s."Round", ''))) AS round_norm
  FROM stats s
  WHERE LOWER(TRIM(s."Event")) = LOWER($1)
    AND ($2::text IS NULL OR LOWER(TRIM(s."Season")) = LOWER($2))
    AND ($3::text IS NULL OR LOWER(TRIM(s."Split")) = LOWER($3))
    AND ($4::text IS NULL OR LOWER(TRIM(s."mode")) = LOWER($4))
    AND ($5::text IS NULL OR LOWER(TRIM(s."scope")) = LOWER($5))
    AND ($6::text IS NULL OR LOWER(TRIM(s."tier")) = LOWER($6))
    AND s.series_id IS NOT NULL
    AND s."Team" IS NOT NULL
    AND TRIM(s."Team") <> ''
),
series_game_results AS (
  SELECT
    bs.series_id,
    bs.team,
    bs.team_norm,
    bs.game_number,
    BOOL_OR(bs.victory) AS game_won,
    MAX(bs.best_of) AS best_of,
    MAX(bs.match_date) AS match_date,
    MAX(bs.round_norm) AS round_norm
  FROM base_scope bs
  GROUP BY bs.series_id, bs.team, bs.team_norm, bs.game_number
),
series_scores AS (
  SELECT
    sgr.series_id,
    sgr.team,
    sgr.team_norm,
    SUM(CASE WHEN sgr.game_won THEN 1 ELSE 0 END)::INT AS wins,
    MAX(sgr.best_of)::INT AS best_of,
    MAX(sgr.match_date) AS match_date,
    MAX(sgr.round_norm) AS round_norm,
    CASE MAX(sgr.round_norm)
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
      WHEN '5'       THEN 30
      WHEN 'R5'      THEN 30
      WHEN 'ROUND 5' THEN 30
      WHEN 'SWISS 4' THEN 28
      WHEN '4'       THEN 28
      WHEN 'R4'      THEN 28
      WHEN 'ROUND 4' THEN 28
      WHEN 'SWISS 3' THEN 26
      WHEN '3'       THEN 26
      WHEN 'R3'      THEN 26
      WHEN 'ROUND 3' THEN 26
      WHEN 'SWISS 2' THEN 24
      WHEN '2'       THEN 24
      WHEN 'R2'      THEN 24
      WHEN 'ROUND 2' THEN 24
      WHEN 'SWISS 1' THEN 22
      WHEN '1'       THEN 22
      WHEN 'ROUND 1' THEN 22
      WHEN 'GROUPS'  THEN 12
      ELSE 0
    END AS depth
  FROM series_game_results sgr
  GROUP BY sgr.series_id, sgr.team, sgr.team_norm
),
paired AS (
  SELECT
    own.series_id,
    own.team AS own_team,
    own.wins AS own_wins,
    opp.team AS opponent,
    opp.wins AS opponent_wins,
    own.best_of,
    own.match_date,
    own.depth
  FROM series_scores own
  JOIN series_scores opp
    ON opp.series_id = own.series_id
   AND opp.team_norm <> own.team_norm
  JOIN roster_teams rt ON rt.team_norm = own.team_norm
)
SELECT
  p.series_id,
  p.opponent,
  p.own_wins,
  p.opponent_wins,
  p.best_of,
  (p.own_wins >= CEIL(COALESCE(p.best_of, 0) / 2.0)) AS won_series,
  p.match_date
FROM paired p
ORDER BY p.depth DESC, p.match_date DESC NULLS LAST, p.series_id DESC
LIMIT 1;
