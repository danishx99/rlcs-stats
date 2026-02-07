# Data Integrity Report

Date: 2026-02-07  
Scope: `stats` table integrity audit using `sql/data-integrity.sql`

## Executive Summary
The current dataset **fails** integrity audit.

- Critical checks failed: `11 / 14`
- Warning checks failed: `2 / 3`
- Total player rows audited: `28,630`
- Distinct `Match ID` values audited: `5,156`

Main risk pattern:
- Structural game completeness is the dominant issue (missing opponent rows, malformed game shapes).
- Winner-flag logic is mostly coherent, but there are a few hard contradictions.
- Text normalization issues are still present and can fragment aggregates/filters.

## Audit Method
Run command:

```bash
psql "postgres://stats:stats_pw@localhost:5432/statsdb" -P pager=off -f "sql/data-integrity.sql"
```

The suite returns standardized checks with:
- `check_id`, `severity`, `status`, `metric_name`, `metric_value`, `threshold`, `sample_json`

Pass/fail policy:
- Any failed `critical` check => audit fail.

## Critical Findings

### 1) Game shape and completeness are significantly broken
- `C01_game_team_count_exactly_two`: `598` `Match ID`s where team count is not 2.
- `C02_match_id_row_count_expected_3v3`: `717` `Match ID`s where row count is not 6.
- `C03_team_rows_per_match_expected_three`: `284` (`Match ID`, `Team`) groups where row count is not 3.
- `C04_player_uniqueness_within_match_team`: `296` groups with non-3/duplicate/missing player identity issues.
- `C15_issue_F_single_team_matches`: `593` one-team `Match ID`s.

Interpretation:
- These are not minor edge cases; they are broad structural defects across raw game rows.
- Any series/game metrics built on raw shape can be distorted by these failures.

### 2) Collision risk persists (reduced vs legacy, not eliminated)
- `C10_issue_A_match_id_collisions`: `5` raw `Match ID`s with >2 teams.
- `C11_issue_B_series_id_collision_risk`: `14` current-series keys with >2 teams.
- Same check payload reports legacy baseline:
  - `legacy_collisions = 249`
  - `worst_legacy_team_count = 16`
  - `worst_current_team_count = 4`

Interpretation:
- Current grouping logic improved collision exposure versus older logic.
- Source-data collisions still leak through and must be treated as root data defects.

### 3) Winner consistency issues are small but real
- `C05_exactly_one_winning_team_per_match`: `5` two-team matches with invalid winner count.
- `C12_issue_C_no_winner_matches`: `5` two-team matches with zero winners.
- `C07_victory_vs_goals_consistency_non_tied`: `1` match where goal winner differs from `Victory` winner.

Interpretation:
- Winner flags are mostly stable, but a small subset can materially affect match outcome analytics.

### 4) Series metadata inconsistency exists
- `C08_series_best_of_consistency`: `1` derived series with conflicting `Best of` values.

Interpretation:
- This indicates at least one series-level metadata contradiction that should be corrected upstream.

## Checks That Passed (Critical)
- `C06_team_level_victory_consistency`: pass (`0` issues)
- `C09_series_winner_threshold_coherence`: pass (`0` issues)
- `C13_issue_D_double_winner_matches`: pass (`0` issues)

Interpretation:
- Within a given team/match row group, victory flags are internally consistent.
- No current two-team matches where both teams are marked winners.

## Warning Findings
- `W16_dimensional_whitespace_variants`: fail (`5` dimensions affected)
  - Most severe in `Split` (`1,566` rows with outer whitespace).
- `W17_case_variants_team_names`: fail (`1` canonical team key with case variants).
- `W14_issue_E_fractional_counts_non_ot`: pass (`0` rows).

Interpretation:
- Data hygiene problems are not just cosmetic; they can split aggregates and break exact-match filtering.

## Representative Examples
From check payload samples:
- Collided match (4 teams in one `Match ID`):
  - `20211112-180631-2021-22-Fall-Regional Event 2-Swiss-2-G1`
- One-team-only match (opponent missing):
  - `20211022-195500-2021-22-Fall-Regional Event 1-Swiss-3-G1`
- Winner contradiction (goals vs `Victory`):
  - `20251130-195938-2026-Boston Major-Open 1-Playoffs-SF-G1`

## Impact Assessment
High impact:
- Series counts, head-to-head history, roster/game totals, and derived rankings can be skewed by structural defects.

Medium impact:
- Winner anomalies are limited in count but directly affect match result trust.

Medium-to-low impact (operationally important):
- Whitespace/case drift causes filter inconsistencies and duplicate dimensions.

## Recommended Review Checklist
Use this to validate the report conclusions before remediation:
1. Re-run `sql/data-integrity.sql` and confirm check counts match this report.
2. Inspect `sample_json` for `C01`, `C02`, `C15` to verify malformed game structures.
3. Validate the single `C07` contradiction match manually in SQL/UI.
4. Confirm `C11` payload values (`legacy_collisions`, `current_collisions`) are reproducible.
5. Decide normalization policy for `Split/Regional/Stage/Round/Team` text fields.
6. Prioritize source data fixes in this order: `C01/C15/C02/C03/C04` then `C05/C07/C12` then `C08/C11`.

## Conclusion
Dataset integrity is currently below production-quality standards for structural game correctness. The audit suite is now in place and reproducible; it should be treated as the baseline gate for data-quality tracking (audit-only for now), with immediate focus on source completeness and collision cleanup.
