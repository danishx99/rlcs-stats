-- Head-to-head history: show series where selected players appeared on opposing teams
-- Counts wins from ALL games in the series, not just games where both players had data
WITH base AS (
  SELECT
    s.*,
    TRIM(s."Team") AS team,
    {{playerKeyExpr}} AS player_key,
    {{seriesIdExpr}} AS series_id
  FROM stats s
  {{where}}
),
-- Identify series where selected players appeared on opposing teams (any game)
h2h_series AS (
  SELECT DISTINCT
    a.series_id,
    a."Date"::date AS match_date,
    a."Round",
    a."Stage",
    a."Season",
    a."Split",
    a."Regional",
    LEAST(a.team, b.team) AS team_a,
    GREATEST(a.team, b.team) AS team_b
  FROM base a
  JOIN base b
    ON b.series_id = a.series_id
    AND b.team != a.team
    AND b.player_key = ANY({{idsParam}})
    AND b.player_key != a.player_key
  WHERE a.player_key = ANY({{idsParam}})
),
-- Get ALL games for those series from the full dataset (not just selected players)
series_games AS (
  SELECT DISTINCT
    base."Date"::date AS match_date,
    base."Round",
    base."Game Number",
    base.team,
    base."Victory",
    base."Best of "
  FROM base
  JOIN h2h_series h
    ON base.series_id = h.series_id
    AND base.team IN (h.team_a, h.team_b)
),
-- Calculate series totals from all games
totals AS (
  SELECT
    h.match_date,
    h."Round",
    h."Stage",
    h."Season",
    h."Split",
    h."Regional",
    h.team_a,
    h.team_b,
    COUNT(DISTINCT CASE WHEN g.team = h.team_a AND g."Victory" THEN g."Game Number" END) AS team_a_wins,
    COUNT(DISTINCT CASE WHEN g.team = h.team_b AND g."Victory" THEN g."Game Number" END) AS team_b_wins,
    MAX(g."Best of ") AS best_of
  FROM h2h_series h
  JOIN series_games g
    ON g.match_date = h.match_date
    AND g."Round" = h."Round"
    AND g.team IN (h.team_a, h.team_b)
  GROUP BY h.match_date, h."Round", h."Stage", h."Season", h."Split", h."Regional", h.team_a, h.team_b
),
-- Get entities (selected players) per team per series
series_entities AS (
  SELECT
    base."Date"::date AS match_date,
    base."Round",
    base.team,
    ARRAY_AGG(DISTINCT base.player_key ORDER BY base.player_key) AS entity_ids
  FROM base
  JOIN h2h_series h
    ON base.series_id = h.series_id
    AND base.team IN (h.team_a, h.team_b)
  WHERE base.player_key = ANY({{idsParam}})
  GROUP BY base."Date"::date, base."Round", base.team
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
