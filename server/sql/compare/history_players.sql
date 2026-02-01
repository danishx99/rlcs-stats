WITH base AS (
  SELECT
    s.*,
    TRIM(s."Team") AS team,
    {{playerKeyExpr}} AS player_key,
    {{seriesIdExpr}} AS series_id
  FROM stats s
  {{where}}
),
game_results AS (
  SELECT
    base.series_id AS series_id,
    base.team AS team,
    base."Game Number" AS game_number,
    MAX(CASE WHEN base."Victory" THEN 1 ELSE 0 END) AS won_game,
    MAX(base."Best of ") AS best_of
  FROM base
  GROUP BY base.series_id, base.team, base."Game Number"
),
series_wins AS (
  SELECT
    series_id,
    team,
    SUM(won_game) AS wins,
    MAX(best_of) AS best_of
  FROM game_results
  GROUP BY series_id, team
),
series_meta AS (
  SELECT
    series_id,
    MIN("Date") AS date,
    MIN("Season") AS season,
    MIN("Split") AS split,
    MIN("Regional") AS regional,
    MIN("Stage") AS stage,
    MIN("Round") AS round
  FROM base
  GROUP BY series_id
),
series_entities AS (
  SELECT
    series_id,
    team,
    ARRAY_AGG(DISTINCT player_key ORDER BY player_key) AS entity_ids
  FROM base
  WHERE player_key = ANY({{idsParam}})
  GROUP BY series_id, team
),
series_with_two AS (
  SELECT series_id
  FROM series_entities
  GROUP BY series_id
  HAVING COUNT(*) >= 2
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
  meta.series_id AS series_id,
  meta.date AS date,
  meta.season AS season,
  meta.split AS split,
  meta.regional AS regional,
  meta.stage AS stage,
  meta.round AS round,
  JSON_AGG(
    JSON_BUILD_OBJECT(
      'team',
      wins.team,
      'wins',
      wins.wins,
      'bestOf',
      wins.best_of,
      'entities',
      (
        SELECT JSON_AGG(
          JSON_BUILD_OBJECT(
            'id',
            e.entity_id,
            'label',
            l.label
          )
          ORDER BY l.label
        )
        FROM UNNEST(entities.entity_ids) AS e(entity_id)
        JOIN entity_labels l ON l.id = e.entity_id
      )
    )
    ORDER BY wins.team
  ) AS teams
FROM series_with_two sw
JOIN series_meta meta ON meta.series_id = sw.series_id
JOIN series_entities entities ON entities.series_id = sw.series_id
JOIN series_wins wins
  ON wins.series_id = entities.series_id
 AND wins.team = entities.team
GROUP BY meta.series_id, meta.date, meta.season, meta.split, meta.regional, meta.stage, meta.round
ORDER BY meta.date DESC NULLS LAST;
