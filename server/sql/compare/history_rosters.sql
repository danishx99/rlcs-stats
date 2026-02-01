{{rosterCtes}},
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
    ARRAY_AGG(DISTINCT roster_id ORDER BY roster_id) AS entity_ids
  FROM series_roster
  WHERE roster_id = ANY({{idsParam}})
  GROUP BY series_id, team
),
series_with_two AS (
  SELECT series_id
  FROM series_entities
  GROUP BY series_id
  HAVING COUNT(*) >= 2
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
            rn.roster_name
          )
          ORDER BY rn.roster_name
        )
        FROM UNNEST(entities.entity_ids) AS e(entity_id)
        LEFT JOIN roster_names rn ON rn.roster_id = e.entity_id
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
