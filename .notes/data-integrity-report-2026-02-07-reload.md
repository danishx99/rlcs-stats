# Data Integrity Report (Post-Fix Reload)

Date: 2026-02-07  
Scope: `stats` + `players` after source fixes and reload  
Integrity suite: `sql/data-integrity.sql`

## Executive Summary
Issue 3 is resolved. The winner-flag inconsistency and the series best-of inconsistency are both cleared. Remaining failures are structural 4-team collision records.

- Critical checks failed: `4 / 14`
- Critical checks passed: `10 / 14`
- Warning checks failed: `0 / 3`
- Warning checks passed: `3 / 3`
- Audit outcome: **FAIL**

Current loaded volume:
- `stats` rows: `24,954`
- `players` rows: `222`

## Data Load Confirmation
Command run:

```bash
bun run src/run.ts --dir ./data --dataset matches --truncate
```

Loader summary:
- `total rows 27768`
- `inserted 24954`
- `skipped 2814`
- `errored 0`
- `series_id backfill: 24894 rows updated`

## Integrity Method
Command run:

```bash
psql "postgres://stats:stats_pw@localhost:5432/statsdb" -P pager=off -f "sql/data-integrity.sql"
```

## Active Critical Findings

### 1) Malformed game structures remain (collision set)
- `C01_game_team_count_exactly_two`: `10` failed match IDs (all `team_count=4`)
- `C10_issue_A_match_id_collisions`: `10` match IDs with >2 teams
- `C15_issue_F_single_team_matches`: **pass** (`0`)

### 2) Team-level 3-player shape still fails downstream of collisions
- `C02_match_id_row_count_expected_3v3`: **pass** (`0`)
- `C03_team_rows_per_match_expected_three`: `30` failing match-team groups
- `C04_player_uniqueness_within_match_team`: `42` failing match-team groups

## Resolved Critical Issues

### Issue 3 resolved: mixed victory flags in a match-team group
- `C06_team_level_victory_consistency`: **pass** (`0`)
- `C05_exactly_one_winning_team_per_match`: **pass** (`0`)
- `C07_victory_vs_goals_consistency_non_tied`: **pass** (`0`)
- `C12_issue_C_no_winner_matches`: **pass** (`0`)
- `C13_issue_D_double_winner_matches`: **pass** (`0`)

### Series metadata consistency resolved
- `C08_series_best_of_consistency`: **pass** (`0`)
- `C09_series_winner_threshold_coherence`: **pass** (`0`)
- `C11_issue_B_series_id_collision_risk`: **pass** (`0`)
  - payload: `legacy_collisions=216`, `current_collisions=0`

## Warning Status
- `W14_issue_E_fractional_counts_non_ot`: **pass** (`0`)
- `W16_dimensional_whitespace_variants`: **pass** (`0`)
- `W17_case_variants_team_names`: **pass** (`0`)

## Series ID Validation (Current)
- rows with null/blank `series_id`: `60`
- `series_id` values with >2 teams: `0`
- match IDs with >1 `series_id`: `0`

## Conclusion
Issue 3 is confirmed fixed and documented as resolved. Current integrity blockers are narrowed to the known 4-team collision cluster and its downstream team-row/player-shape effects.
