-- Head-to-head history: show series where selected players actually played against each other
-- Groups games by date + round to show proper series scores (e.g., 2-4, not 0-1/1-0 per game)
WITH base AS (
  SELECT
    s.*,
    TRIM(s."Team") AS team,
    {{playerKeyExpr}} AS player_key,
    {{seriesIdExpr}} AS series_id
  FROM stats s
  {{where}}
),
-- Find all games where selected players played against each other
head_to_head_games AS (
  SELECT DISTINCT
    base.series_id,
    base."Date"::date AS match_date,
    base."Round",
    base."Stage",
    base."Season",
    base."Split",
    base."Regional",
    base."Game Number",
    base.team,
    base.player_key,
    base."Victory",
    base."Best of "
  FROM base
  WHERE base.player_key = ANY({{idsParam}})
    AND EXISTS (
      SELECT 1 FROM base b2
      WHERE b2.series_id = base.series_id
        AND b2."Game Number" = base."Game Number"
        AND b2.team != base.team
        AND b2.player_key = ANY({{idsParam}})
        AND b2.player_key != base.player_key
    )
),
-- Identify the two teams that played each other
matchups AS (
  SELECT DISTINCT
    match_date,
    "Round",
    "Stage",
    "Season",
    "Split",
    "Regional",
    MIN(team) AS team_a,
    MAX(team) AS team_b
  FROM head_to_head_games
  GROUP BY match_date, "Round", "Stage", "Season", "Split", "Regional"
  HAVING COUNT(DISTINCT team) = 2
),
-- Calculate series totals by grouping all games in same date+round
totals AS (
  SELECT 
    m.match_date,
    m."Round",
    m."Stage",
    m."Season",
    m."Split",
    m."Regional",
    m.team_a,
    m.team_b,
    COUNT(DISTINCT CASE WHEN h.team = m.team_a AND h."Victory" THEN h."Game Number" END) AS team_a_wins,
    COUNT(DISTINCT CASE WHEN h.team = m.team_b AND h."Victory" THEN h."Game Number" END) AS team_b_wins,
    MAX(h."Best of ") AS best_of
  FROM matchups m
  JOIN head_to_head_games h
    ON h.match_date = m.match_date
    AND h."Round" = m."Round"
    AND h.team IN (m.team_a, m.team_b)
  GROUP BY m.match_date, m."Round", m."Stage", m."Season", m."Split", m."Regional", m.team_a, m.team_b
),
-- Get entities (players) per team
series_entities AS (
  SELECT
    h.match_date,
    h."Round",
    h.team,
    ARRAY_AGG(DISTINCT h.player_key ORDER BY h.player_key) AS entity_ids
  FROM head_to_head_games h
  GROUP BY h.match_date, h."Round", h.team
),
-- Get player labels
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
  ON se.match_date = t.match_date 
  AND se."Round" = t."Round"
  AND se.team = t.team_a
LEFT JOIN series_entities se2 
  ON se2.match_date = t.match_date 
  AND se2."Round" = t."Round"
  AND se2.team = t.team_b
ORDER BY t.match_date DESC NULLS LAST;
