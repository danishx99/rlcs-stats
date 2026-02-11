WITH base_scope AS (
  SELECT *
  FROM stats
  WHERE LOWER(TRIM("Regional")) = LOWER($1)
    AND ($2::text IS NULL OR LOWER(TRIM("Season")) = LOWER($2))
    AND ($3::text IS NULL OR LOWER(TRIM("Split")) = LOWER($3))
    AND series_id IS NOT NULL
),
has_playoffs AS (
  SELECT EXISTS (
    SELECT 1
    FROM base_scope
    WHERE LOWER(TRIM("Stage")) = 'playoffs'
  ) AS yes
),
scoped AS (
  SELECT b.*
  FROM base_scope b
  CROSS JOIN has_playoffs hp
  WHERE (hp.yes AND LOWER(TRIM(b."Stage")) = 'playoffs')
     OR (NOT hp.yes)
),
team_series AS (
  SELECT
    series_id,
    "Team" AS team,
    UPPER(TRIM("Round")) AS rnd,
    MAX("Date") AS series_date,
    CASE UPPER(TRIM("Round"))
      WHEN 'GF'     THEN 100
      WHEN 'UF'     THEN 90
      WHEN 'LF'     THEN 90
      WHEN 'SF'     THEN 80
      WHEN 'USF'    THEN 80
      WHEN 'LSF'    THEN 80
      WHEN 'QF'     THEN 70
      WHEN 'UQF'    THEN 70
      WHEN 'LQF'    THEN 70
      WHEN 'LR3'    THEN 60
      WHEN 'LR2'    THEN 50
      WHEN 'LR1'    THEN 40
      WHEN 'UR1'    THEN 40
      WHEN 'R1'     THEN 40
      WHEN 'SWISS 5' THEN 30
      WHEN 'SWISS 4' THEN 28
      WHEN 'SWISS 3' THEN 26
      WHEN 'SWISS 2' THEN 24
      WHEN 'SWISS 1' THEN 22
      WHEN 'GROUPS'  THEN 12
      ELSE 0
    END AS depth,
    SUM(CASE WHEN "Victory" = true THEN 1 ELSE 0 END) AS game_wins
  FROM scoped
  GROUP BY series_id, "Team", UPPER(TRIM("Round"))
),
ranked_series AS (
  SELECT
    ts.*,
    RANK() OVER (PARTITION BY ts.series_id ORDER BY ts.game_wins DESC) AS series_rank
  FROM team_series ts
),
team_latest AS (
  SELECT DISTINCT ON (team)
    team,
    rnd AS deep_round,
    depth AS round_depth,
    series_id,
    series_date,
    game_wins,
    (series_rank = 1) AS won_deepest
  FROM ranked_series
  ORDER BY team, series_date DESC NULLS LAST, depth DESC, series_id DESC
),
classified AS (
  SELECT
    tl.*,
    (tl.deep_round = 'GF' AND tl.won_deepest) AS is_champion,
    (NOT (tl.deep_round = 'GF' AND tl.won_deepest) AND NOT tl.won_deepest) AS is_eliminated
  FROM team_latest tl
),
placement_basis AS (
  SELECT
    c.*,
    CASE
      WHEN c.is_champion THEN NULL::int
      WHEN c.is_eliminated THEN c.round_depth
      ELSE COALESCE(
        (
          SELECT MIN(e.round_depth)
          FROM (
            SELECT DISTINCT round_depth
            FROM classified
            WHERE is_eliminated
          ) e
          WHERE e.round_depth > c.round_depth
        ),
        c.round_depth
      )
    END AS effective_depth
  FROM classified c
),
elim_groups AS (
  SELECT
    effective_depth AS round_depth,
    COUNT(*) AS team_count
  FROM placement_basis
  WHERE NOT is_champion
  GROUP BY effective_depth
),
elim_ranges AS (
  SELECT
    eg.round_depth,
    eg.team_count,
    COALESCE(
      SUM(eg.team_count) OVER (
        ORDER BY eg.round_depth DESC
        ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
      ),
      0
    ) + 2 AS placement_start
  FROM elim_groups eg
),
placed AS (
  SELECT
    pb.team,
    pb.deep_round,
    pb.round_depth,
    pb.won_deepest,
    CASE
      WHEN pb.is_champion THEN 1
      WHEN pb.effective_depth IS NOT NULL THEN er.placement_start
      ELSE 999
    END AS placement_start,
    CASE
      WHEN pb.is_champion THEN 1
      WHEN pb.effective_depth IS NOT NULL THEN er.placement_start + er.team_count - 1
      ELSE 999
    END AS placement_end
  FROM placement_basis pb
  LEFT JOIN elim_ranges er
    ON er.round_depth = pb.effective_depth
)
SELECT p.team, p.deep_round, p.round_depth,
  p.won_deepest,
  p.placement_start,
  p.placement_end,
  (SELECT tp."Logo Link" FROM team_profiles tp
   WHERE UPPER(tp."Team Name") = UPPER(p.team) LIMIT 1) AS logo_url
FROM placed p
WHERE p.placement_start < 999
ORDER BY p.placement_start ASC, p.placement_end ASC, p.round_depth DESC, p.team ASC
LIMIT $4;
