WITH base_scope AS (
  SELECT *
  FROM stats
  WHERE LOWER(TRIM("Event")) = LOWER($1)
    AND ($2::text IS NULL OR LOWER(TRIM("Season")) = LOWER($2))
    AND ($3::text IS NULL OR LOWER(TRIM("Split")) = LOWER($3))
    AND ($4::text IS NULL OR LOWER(TRIM("mode")) = LOWER($4))
    AND ($5::text IS NULL OR LOWER(TRIM("scope")) = LOWER($5))
    AND ($6::text IS NULL OR LOWER(TRIM("tier")) = LOWER($6))
    AND "Team" IS NOT NULL
    AND TRIM("Team") <> ''
),
has_playoffs AS (
  SELECT EXISTS (
    SELECT 1
    FROM base_scope
    WHERE LOWER(TRIM("Stage")) = 'playoffs'
  ) AS yes
),
event_meta AS (
  SELECT
    MIN(LOWER(TRIM("mode"))) AS mode,
    MIN(LOWER(TRIM("scope"))) AS scope,
    MIN(LOWER(TRIM("tier"))) AS tier
  FROM base_scope
),
scoped_playoff AS (
  SELECT b.*
  FROM base_scope b
  CROSS JOIN has_playoffs hp
  WHERE (hp.yes AND LOWER(TRIM(b."Stage")) = 'playoffs')
     OR (NOT hp.yes)
),
team_rounds AS (
  SELECT
    CASE
      WHEN LOWER(TRIM("mode")) = '1s' AND COALESCE(TRIM("Unique ID"), '') <> '' THEN UPPER(TRIM("Unique ID"))
      ELSE UPPER(TRIM("Team"))
    END AS participant_norm,
    MIN(
      CASE
        WHEN LOWER(TRIM("mode")) = '1s' THEN NULLIF(TRIM("Unique ID"), '')
        ELSE NULL
      END
    ) AS unique_id,
    MIN(TRIM("Team")) AS team,
    UPPER(TRIM("Round")) AS rnd,
    MAX("Date") AS round_date,
    CASE UPPER(TRIM("Round"))
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
    END AS depth,
    (
      SUM(CASE WHEN "Victory" = true THEN 1 ELSE 0 END)
      >
      SUM(CASE WHEN COALESCE("Victory", false) = false THEN 1 ELSE 0 END)
    ) AS won_round
  FROM scoped_playoff
  WHERE "Round" IS NOT NULL
    AND TRIM("Round") <> ''
  GROUP BY
    CASE
      WHEN LOWER(TRIM("mode")) = '1s' AND COALESCE(TRIM("Unique ID"), '') <> '' THEN UPPER(TRIM("Unique ID"))
      ELSE UPPER(TRIM("Team"))
    END,
    UPPER(TRIM("Round"))
),
team_latest AS (
  SELECT DISTINCT ON (participant_norm)
    participant_norm,
    unique_id,
    team,
    rnd AS deep_round,
    depth AS round_depth,
    round_date,
    won_round AS won_deepest
  FROM team_rounds
  ORDER BY participant_norm, depth DESC, round_date DESC NULLS LAST
),
team_latest_losses AS (
  SELECT
    ranked.participant_norm,
    ranked.depth AS elimination_depth
  FROM (
    SELECT
      tr.participant_norm,
      tr.depth,
      tr.round_date,
      ROW_NUMBER() OVER (
        PARTITION BY tr.participant_norm
        ORDER BY tr.round_date DESC NULLS LAST, tr.depth DESC
      ) AS rn
    FROM team_rounds tr
    WHERE tr.won_round = false
      AND tr.depth > 0
  ) ranked
  WHERE ranked.rn = 1
),
team_loss_depths AS (
  SELECT
    tl.participant_norm,
    tl.elimination_depth
  FROM team_latest_losses tl
),
classified AS (
  SELECT
    tl.*,
    tld.elimination_depth,
    (tl.round_depth = 100 AND tl.won_deepest) AS is_champion,
    (NOT (tl.round_depth = 100 AND tl.won_deepest) AND NOT tl.won_deepest) AS is_eliminated
  FROM team_latest tl
  LEFT JOIN team_loss_depths tld
    ON tld.participant_norm = tl.participant_norm
),
placement_basis AS (
  SELECT
    c.*,
    CASE
      WHEN c.is_champion THEN NULL::int
      WHEN c.is_eliminated THEN
        CASE
          WHEN c.round_depth = 100 THEN 100
          ELSE COALESCE(c.elimination_depth, c.round_depth)
        END
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
playoff_placed AS (
  SELECT
    pb.participant_norm,
    pb.unique_id,
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
),
playoff_anchor AS (
  SELECT COALESCE(MAX(placement_end) FILTER (WHERE placement_end < 999), 0) AS placement_anchor
  FROM playoff_placed
),
non_playoff_game_results AS (
  SELECT
    CASE
      WHEN LOWER(TRIM(bs."mode")) = '1s' AND COALESCE(TRIM(bs."Unique ID"), '') <> '' THEN UPPER(TRIM(bs."Unique ID"))
      ELSE UPPER(TRIM(bs."Team"))
    END AS participant_norm,
    MIN(
      CASE
        WHEN LOWER(TRIM(bs."mode")) = '1s' THEN NULLIF(TRIM(bs."Unique ID"), '')
        ELSE NULL
      END
    ) AS unique_id,
    MIN(TRIM(bs."Team")) AS team,
    UPPER(TRIM(bs."Round")) AS rnd,
    bs.series_id,
    bs."Game Number" AS game_number,
    MAX(bs."Date") AS match_date,
    MAX(bs."Best of ") AS best_of,
    BOOL_OR(bs."Victory") AS game_won,
    CASE UPPER(TRIM(bs."Round"))
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
  FROM base_scope bs
  JOIN has_playoffs hp
    ON hp.yes
  LEFT JOIN playoff_placed pp
    ON pp.participant_norm = CASE
      WHEN LOWER(TRIM(bs."mode")) = '1s' AND COALESCE(TRIM(bs."Unique ID"), '') <> '' THEN UPPER(TRIM(bs."Unique ID"))
      ELSE UPPER(TRIM(bs."Team"))
    END
  WHERE bs.series_id IS NOT NULL
    AND bs."Round" IS NOT NULL
    AND TRIM(bs."Round") <> ''
    AND pp.participant_norm IS NULL
    AND NOT (LOWER(TRIM(bs."Stage")) LIKE '%playoff%')
  GROUP BY
    CASE
      WHEN LOWER(TRIM(bs."mode")) = '1s' AND COALESCE(TRIM(bs."Unique ID"), '') <> '' THEN UPPER(TRIM(bs."Unique ID"))
      ELSE UPPER(TRIM(bs."Team"))
    END,
    UPPER(TRIM(bs."Round")),
    bs.series_id,
    bs."Game Number"
),
non_playoff_series_results AS (
  SELECT
    participant_norm,
    MAX(unique_id) AS unique_id,
    team,
    rnd,
    depth,
    series_id,
    MAX(best_of) AS best_of,
    MAX(match_date) AS match_date,
    SUM(CASE WHEN game_won THEN 1 ELSE 0 END) AS wins
  FROM non_playoff_game_results
  GROUP BY participant_norm, team, rnd, depth, series_id
),
non_playoff_losses AS (
  SELECT
    participant_norm,
    unique_id,
    team,
    rnd,
    depth,
    series_id,
    match_date
  FROM non_playoff_series_results
  WHERE wins < CEIL(best_of / 2.0)
    AND depth > 0
),
non_playoff_elimination AS (
  SELECT
    ranked.participant_norm,
    ranked.unique_id,
    ranked.team,
    ranked.rnd AS deep_round,
    ranked.depth AS round_depth
  FROM (
    SELECT
      npl.*,
      ROW_NUMBER() OVER (
        PARTITION BY npl.participant_norm
        ORDER BY npl.depth DESC, npl.match_date DESC NULLS LAST, npl.series_id DESC
      ) AS rn
    FROM non_playoff_losses npl
  ) ranked
  WHERE ranked.rn = 1
),
non_playoff_groups AS (
  SELECT
    round_depth,
    COUNT(*) AS team_count
  FROM non_playoff_elimination
  GROUP BY round_depth
),
non_playoff_ranges AS (
  SELECT
    npg.round_depth,
    npg.team_count,
    (SELECT placement_anchor FROM playoff_anchor) + COALESCE(
      SUM(npg.team_count) OVER (
        ORDER BY npg.round_depth DESC
        ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
      ),
      0
    ) + 1 AS placement_start
  FROM non_playoff_groups npg
),
non_playoff_placed AS (
  SELECT
    npe.participant_norm,
    npe.unique_id,
    npe.team,
    npe.deep_round,
    npe.round_depth,
    false AS won_deepest,
    npr.placement_start,
    npr.placement_start + npr.team_count - 1 AS placement_end
  FROM non_playoff_elimination npe
  JOIN non_playoff_ranges npr
    ON npr.round_depth = npe.round_depth
),
all_placed AS (
  SELECT participant_norm, unique_id, team, deep_round, round_depth, won_deepest, placement_start, placement_end
  FROM playoff_placed
  UNION ALL
  SELECT participant_norm, unique_id, team, deep_round, round_depth, won_deepest, placement_start, placement_end
  FROM non_playoff_placed
),
lan_group_overrides AS (
  SELECT
    ap.participant_norm,
    CASE ap.round_depth
      WHEN 26 THEN 13
      WHEN 28 THEN 9
      WHEN 30 THEN 5
      ELSE NULL
    END AS placement_start,
    CASE ap.round_depth
      WHEN 26 THEN 16
      WHEN 28 THEN 12
      WHEN 30 THEN 8
      ELSE NULL
    END AS placement_end
  FROM all_placed ap
  CROSS JOIN has_playoffs hp
  CROSS JOIN event_meta em
  WHERE NOT hp.yes
    AND em.mode = '3s'
    AND em.scope = 'international'
    AND em.tier IN ('major', 'worlds')
    AND ap.won_deepest = false
    AND ap.round_depth IN (26, 28, 30)
),
final_placed AS (
  SELECT
    ap.participant_norm,
    ap.unique_id,
    ap.team,
    ap.deep_round,
    ap.round_depth,
    ap.won_deepest,
    COALESCE(lgo.placement_start, ap.placement_start) AS placement_start,
    COALESCE(lgo.placement_end, ap.placement_end) AS placement_end
  FROM all_placed ap
  LEFT JOIN lan_group_overrides lgo
    ON lgo.participant_norm = ap.participant_norm
)
SELECT
  p.team,
  p.unique_id,
  p.deep_round,
  p.round_depth,
  p.won_deepest,
  p.placement_start,
  p.placement_end,
  (
    SELECT tp."Logo Link"
    FROM team_profiles tp
    WHERE UPPER(tp."Team Name") = UPPER(p.team)
    LIMIT 1
  ) AS logo_url,
  (
    SELECT pl."Photo URL"
    FROM players pl
    WHERE UPPER(TRIM(pl."Unique ID")) = UPPER(TRIM(p.unique_id))
    LIMIT 1
  ) AS photo_url
FROM final_placed p
WHERE p.placement_start < 999
ORDER BY p.placement_start ASC, p.placement_end ASC, p.round_depth DESC, p.team ASC
LIMIT $7;
