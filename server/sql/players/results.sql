-- Per-event tournament results for a player
-- Returns placement + series detail for each event, grouped by season
WITH stats_base AS (
  SELECT
    s.*,
    {{playerKeyExpr}} AS player_key
  FROM stats s
  {{where}}
),
player_stats AS (
  SELECT *
  FROM stats_base
  WHERE player_key = {{playerIdParam}}
    AND series_id IS NOT NULL
),
available_seasons AS (
  SELECT DISTINCT "Season" AS season
  FROM player_stats
  ORDER BY season DESC
),
series_summary AS (
  SELECT
    series_id,
    "Season" AS season,
    "Split" AS split,
    "Regional" AS regional,
    "Stage" AS stage,
    MIN("Round") AS round,
    "Team" AS team,
    MAX("Best of ") AS best_of,
    SUM(CASE WHEN "Victory" THEN 1 ELSE 0 END) AS wins,
    MIN("Date") AS match_date
  FROM player_stats
  GROUP BY series_id, "Season", "Split", "Regional", "Stage", "Team"
),
series_winners AS (
  SELECT
    *,
    wins >= CEIL(best_of / 2.0) AS won_series
  FROM series_summary
),
opponent_summary AS (
  SELECT
    s.series_id,
    TRIM(s."Team") AS opp_team,
    COUNT(DISTINCT CASE WHEN s."Victory" THEN s."Game Number" END) AS opp_wins
  FROM stats_base s
  JOIN series_summary ss ON s.series_id = ss.series_id
  WHERE TRIM(s."Team") <> ss.team
  GROUP BY s.series_id, TRIM(s."Team")
),
event_gf AS (
  SELECT
    season,
    split,
    regional,
    stage,
    MAX(
      CASE
        WHEN round ILIKE '%GF 2%' OR round ILIKE '%GF2%' THEN 2
        WHEN round ILIKE '%GF 1%' OR round ILIKE '%GF1%' THEN 1
        WHEN round ILIKE '%GF%' THEN 1
        ELSE 0
      END
    ) AS gf_tier
  FROM series_summary
  GROUP BY season, split, regional, stage
),
gf_champs AS (
  SELECT s.*
  FROM series_winners s
  JOIN event_gf e
    ON s.season IS NOT DISTINCT FROM e.season
   AND s.split IS NOT DISTINCT FROM e.split
   AND s.regional IS NOT DISTINCT FROM e.regional
   AND s.stage IS NOT DISTINCT FROM e.stage
  WHERE s.won_series = true
    AND (
      (e.gf_tier = 2 AND (s.round ILIKE '%GF 2%' OR s.round ILIKE '%GF2%'))
      OR (e.gf_tier <= 1 AND s.round ILIKE '%GF%')
    )
),
distinct_events AS (
  SELECT DISTINCT season, split, regional
  FROM series_summary
),
event_placement AS (
  SELECT
    de.season,
    de.split,
    de.regional,
    CASE
      WHEN EXISTS (
        SELECT 1 FROM gf_champs gc
        WHERE gc.season IS NOT DISTINCT FROM de.season
          AND gc.split IS NOT DISTINCT FROM de.split
          AND gc.regional IS NOT DISTINCT FROM de.regional
      ) THEN 'Top 1'
      WHEN EXISTS (
        SELECT 1 FROM series_summary s2
        WHERE s2.season IS NOT DISTINCT FROM de.season
          AND s2.split IS NOT DISTINCT FROM de.split
          AND s2.regional IS NOT DISTINCT FROM de.regional
          AND s2.round ILIKE '%GF%'
      ) THEN 'Top 2'
      WHEN EXISTS (
        SELECT 1 FROM series_summary s2
        WHERE s2.season IS NOT DISTINCT FROM de.season
          AND s2.split IS NOT DISTINCT FROM de.split
          AND s2.regional IS NOT DISTINCT FROM de.regional
          AND s2.round ILIKE '%SF%'
      ) THEN 'Top 4'
      WHEN EXISTS (
        SELECT 1 FROM series_summary s2
        WHERE s2.season IS NOT DISTINCT FROM de.season
          AND s2.split IS NOT DISTINCT FROM de.split
          AND s2.regional IS NOT DISTINCT FROM de.regional
          AND (s2.round ILIKE '%QF%')
      ) THEN 'Top 8'
      WHEN EXISTS (
        SELECT 1 FROM series_summary s2
        WHERE s2.season IS NOT DISTINCT FROM de.season
          AND s2.split IS NOT DISTINCT FROM de.split
          AND s2.regional IS NOT DISTINCT FROM de.regional
          AND (s2.round ILIKE '%R16%' OR s2.round ILIKE '%16%')
      ) THEN 'Top 16'
      WHEN EXISTS (
        SELECT 1 FROM series_summary s2
        WHERE s2.season IS NOT DISTINCT FROM de.season
          AND s2.split IS NOT DISTINCT FROM de.split
          AND s2.regional IS NOT DISTINCT FROM de.regional
          AND (s2.round ILIKE '%R32%' OR s2.round ILIKE '%32%')
      ) THEN 'Top 32'
      WHEN EXISTS (
        SELECT 1 FROM series_summary s2
        WHERE s2.season IS NOT DISTINCT FROM de.season
          AND s2.split IS NOT DISTINCT FROM de.split
          AND s2.regional IS NOT DISTINCT FROM de.regional
          AND s2.stage ILIKE '%Playoff%'
      ) THEN 'Top 8'
      WHEN EXISTS (
        SELECT 1 FROM series_summary s2
        WHERE s2.season IS NOT DISTINCT FROM de.season
          AND s2.split IS NOT DISTINCT FROM de.split
          AND s2.regional IS NOT DISTINCT FROM de.regional
          AND s2.stage ILIKE '%Swiss%'
      ) THEN 'Top 16'
      ELSE NULL
    END AS placement
  FROM distinct_events de
),
series_detail AS (
  SELECT
    sw.series_id,
    sw.season,
    sw.split,
    sw.regional,
    sw.stage,
    sw.round,
    sw.team,
    sw.best_of,
    sw.wins AS player_wins,
    sw.won_series,
    sw.match_date,
    os.opp_team AS opponent,
    COALESCE(os.opp_wins, 0) AS opponent_wins,
    ROW_NUMBER() OVER (
      PARTITION BY sw.season, sw.split, sw.regional
      ORDER BY
        CASE
          WHEN UPPER(TRIM(sw.round)) LIKE 'GF%' THEN 100
          WHEN UPPER(TRIM(sw.round)) = 'UF' THEN 90
          WHEN UPPER(TRIM(sw.round)) = 'LF' THEN 90
          WHEN UPPER(TRIM(sw.round)) = 'SF' THEN 80
          WHEN UPPER(TRIM(sw.round)) = 'USF' THEN 80
          WHEN UPPER(TRIM(sw.round)) = 'LSF' THEN 80
          WHEN UPPER(TRIM(sw.round)) = 'QF' THEN 70
          WHEN UPPER(TRIM(sw.round)) = 'UQF' THEN 70
          WHEN UPPER(TRIM(sw.round)) = 'LQF' THEN 70
          WHEN UPPER(TRIM(sw.round)) = 'LR3' THEN 60
          WHEN UPPER(TRIM(sw.round)) = 'LR2' THEN 50
          WHEN UPPER(TRIM(sw.round)) = 'LR1' THEN 40
          WHEN UPPER(TRIM(sw.round)) = 'UR1' THEN 40
          WHEN UPPER(TRIM(sw.round)) = 'R1' THEN 40
          WHEN UPPER(TRIM(sw.round)) = 'SWISS 5' THEN 30
          WHEN UPPER(TRIM(sw.round)) = 'SWISS 4' THEN 28
          WHEN UPPER(TRIM(sw.round)) = 'SWISS 3' THEN 26
          WHEN UPPER(TRIM(sw.round)) = 'SWISS 2' THEN 24
          WHEN UPPER(TRIM(sw.round)) = 'SWISS 1' THEN 22
          WHEN UPPER(TRIM(sw.round)) = 'GROUPS' THEN 12
          ELSE 0
        END DESC,
        sw.match_date DESC NULLS LAST,
        sw.series_id DESC
    ) AS rn
  FROM series_winners sw
  LEFT JOIN opponent_summary os ON sw.series_id = os.series_id
)
SELECT
  ep.season,
  ep.split,
  ep.regional,
  ep.placement,
  (
    SELECT JSON_AGG(sub ORDER BY sub.date ASC NULLS LAST)
    FROM (
      SELECT
        sd.series_id,
        sd.round,
        sd.stage,
        sd.opponent,
        sd.player_wins,
        sd.opponent_wins,
        sd.best_of,
        sd.won_series,
        sd.match_date AS date
      FROM series_detail sd
      WHERE sd.season IS NOT DISTINCT FROM ep.season
        AND sd.split IS NOT DISTINCT FROM ep.split
        AND sd.regional IS NOT DISTINCT FROM ep.regional
        AND sd.rn = 1
    ) sub
  ) AS series,
  (SELECT JSON_AGG(a.season) FROM available_seasons a) AS available_seasons
FROM event_placement ep
LEFT JOIN (
  SELECT season, split, regional, MAX(match_date) AS latest_date
  FROM series_summary
  GROUP BY season, split, regional
) ed ON ep.season IS NOT DISTINCT FROM ed.season
   AND ep.split IS NOT DISTINCT FROM ed.split
   AND ep.regional IS NOT DISTINCT FROM ed.regional
ORDER BY ed.latest_date DESC NULLS LAST;
