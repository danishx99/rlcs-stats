# Data Integrity Full Report

Generated: 2026-02-12 16:12:56 UTC
Database: `statsdb`
Input snapshots:
- `out/data-integrity-current.tsv`
- `out/series-id-preflight-current.tsv`

## Executive Summary

Current run shows 22 total checks.

- Critical: 19 total (`7` pass, `12` fail)
- Warning: 3 total (`3` pass, `0` fail)

Series-linking status from preflight:
- Total `stats` rows: `28026`
- Rows with null/blank `series_id`: `1`
- Affected match IDs: `1`
- Affected source file: `2025 Season Database - 2025 Birmingham Major (2).csv`

## Failing Checks (Current)

- `C01_game_team_count_exactly_two` (critical): `match_ids_with_team_count_not_2 = 1`
- `C02_match_id_row_count_expected_3v3` (critical): `match_ids_with_row_count_not_6 = 2`
- `C03_team_rows_per_match_expected_three` (critical): `match_team_groups_with_row_count_not_3 = 2`
- `C04_player_uniqueness_within_match_team` (critical): `match_team_groups_with_player_identity_issues = 2`
- `C07_victory_vs_goals_consistency_non_tied` (critical): `non_tied_two_team_matches_where_goal_winner_differs_from_victory_winner = 1`
- `C08_series_best_of_consistency` (critical): `derived_series_keys_with_conflicting_best_of = 1`
- `C14_player_name_unique_id_consistency` (critical): `player_names_with_multiple_unique_ids = 5`
- `C15_issue_F_single_team_matches` (critical): `match_ids_with_single_team_only = 1`
- `C16_series_id_best_of_row_completeness` (critical): `series_ids_with_best_of_shape_or_row_count_issues = 5`
- `C17_playoff_missing_followup_series_after_latest_win` (critical): `playoff_teams_with_latest_series_win_but_no_recorded_followup = 4`
- `C18_playoff_bracket_depth_date_conflict` (critical): `playoff_series_pairs_where_deeper_round_precedes_shallower_round = 6`
- `C19_match_ids_with_missing_series_id_rows` (critical): `match_ids_with_null_or_blank_series_id_rows = 1`

## Key Impacted Records

### Incomplete / single-team game rows

- `20250509-173321-2025-Raleigh Major -Open 5-GSL-LQF-G2`
  - team rows present: `STR1VE ESPORTS` only (`1` row, `1` player)
  - source file: `2025 Season Database - 2025 Birmingham Major (2).csv`
- `20250509-173321-2025-Raleigh Major -Open 5-GSL-LQF-G5`
  - `STR1VE ESPORTS`: `2` rows (`2` players)
  - `WE'LL HAVE A LOOK`: `3` rows (`3` players)
  - source file: `2025 Season Database - 2025 Birmingham Major (2).csv`

### Winner vs goals mismatch (same match)

- Match ID: `20230609-185336-2022-23-Spring-Invitational-Double Elim-LR1-G2`
- `ICE ESPORTS`: goals `1`, victory flag `false`
- `RED CROWN ESPORTS`: goals `0`, victory flag `true`
- source file: `2022-23 Season Database - 22-23 Season (5).csv`

### Conflicting best-of values for same series context

Context key:
- season `2022-23`, split `Winter`, regional `Invitational`, stage `Playoffs`, round `R1`, teams `ATK` vs `SRZ`

Observed conflict:
- best-of `5` and best-of `7` both present
- conflicting row occurs on match: `20230224-202213-2022-23-Winter-Invitational-Playoffs-R1-G3`
- source file: `2022-23 Season Database - 22-23 Season (5).csv`

### Player name to Unique ID drift

- `twnzr` -> `SSA-P-10148`, `SSA-P-10177`
- `pnda.` -> `SSA-P-10066`, `SSA-P-10084`
- `lazybear` -> `SSA-P-10147`, `SSA-P-10174`
- `Paarthurnax.` -> `SSA-P-10045`, `SSA-P-10101`
- `ckeno.` -> `SSA-P-10070`, `SSA-P-10110`

### Series shape/completeness issues (best-of expectations)

Affected `series_id` values:
- `6c9afee974c1e4d186a20c2ca91e4f16`
- `72d3b833d2c4fb15ed970788ee3f2008`
- `fc1b392745e5490b828b1d5fbfca980a`
- `fc550c08025962e5910328450c36d4c4`
- `119b179bd49f1ecb823a9edaba9b8e3b`

### Playoff progression anomalies

Teams flagged:
- `TRADUIS SI TU PUES`
- `LIMITLESS`
- `BOT GAMING`
- `AIPX`
- `YOUNG MONEY CLAN`

Key series IDs in flagged chains:
- `5c1a359af90b538504de8aea21b01459`
- `528d2998b536a299885741c22c5e7769`
- `15c45f6ae29788dce047ec6c3f310547`
- `3d2bc71978a48c84f062657e5305f800`
- `9e44866db7d869048b08d93defbf281d`
- `8cb3f99361af1d3ef6333914a9c6a5c9`
- `39c5880aca61eb5161c0e9ed50b00b2f`
- `4b4ca7f830e43e8803ccd00ac7ff6a68`
- `665968759df2dbdb38e9dda585c3142a`

## Full Check Matrix

| Check ID | Severity | Status | Metric | Value |
|---|---|---|---|---|
| `C01_game_team_count_exactly_two` | critical | fail | `match_ids_with_team_count_not_2` | 1 |
| `C02_match_id_row_count_expected_3v3` | critical | fail | `match_ids_with_row_count_not_6` | 2 |
| `C03_team_rows_per_match_expected_three` | critical | fail | `match_team_groups_with_row_count_not_3` | 2 |
| `C04_player_uniqueness_within_match_team` | critical | fail | `match_team_groups_with_player_identity_issues` | 2 |
| `C05_exactly_one_winning_team_per_match` | critical | pass | `two_team_matches_with_winner_count_not_1` | 0 |
| `C06_team_level_victory_consistency` | critical | pass | `match_team_groups_with_mixed_victory_flags` | 0 |
| `C07_victory_vs_goals_consistency_non_tied` | critical | fail | `non_tied_two_team_matches_where_goal_winner_differs_from_victory_winner` | 1 |
| `C08_series_best_of_consistency` | critical | fail | `derived_series_keys_with_conflicting_best_of` | 1 |
| `C09_series_winner_threshold_coherence` | critical | pass | `derived_series_keys_with_impossible_winner_state` | 0 |
| `C10_issue_A_match_id_collisions` | critical | pass | `match_ids_with_more_than_2_teams` | 0 |
| `C11_issue_B_series_id_collision_risk` | critical | pass | `current_series_ids_with_more_than_2_teams` | 0 |
| `C12_issue_C_no_winner_matches` | critical | pass | `two_team_matches_with_zero_winners` | 0 |
| `C13_issue_D_double_winner_matches` | critical | pass | `two_team_matches_with_more_than_one_winner` | 0 |
| `C14_player_name_unique_id_consistency` | critical | fail | `player_names_with_multiple_unique_ids` | 5 |
| `C15_issue_F_single_team_matches` | critical | fail | `match_ids_with_single_team_only` | 1 |
| `C16_series_id_best_of_row_completeness` | critical | fail | `series_ids_with_best_of_shape_or_row_count_issues` | 5 |
| `C17_playoff_missing_followup_series_after_latest_win` | critical | fail | `playoff_teams_with_latest_series_win_but_no_recorded_followup` | 4 |
| `C18_playoff_bracket_depth_date_conflict` | critical | fail | `playoff_series_pairs_where_deeper_round_precedes_shallower_round` | 6 |
| `C19_match_ids_with_missing_series_id_rows` | critical | fail | `match_ids_with_null_or_blank_series_id_rows` | 1 |
| `W14_issue_E_fractional_counts_non_ot` | warning | pass | `player_rows_with_fractional_count_stats_in_non_ot` | 0 |
| `W16_dimensional_whitespace_variants` | warning | pass | `dimensions_with_outer_whitespace_variants` | 0 |
| `W17_case_variants_team_names` | warning | pass | `canonical_team_keys_with_case_variants` | 0 |

## Priority Order to Resolve

1. Fix incomplete/single-team rows in `2025 Season Database - 2025 Birmingham Major (2).csv` (this clears C01/C02/C03/C04/C15/C19 together).
2. Fix winner/goal mismatch in `2022-23 Season Database - 22-23 Season (5).csv` (C07).
3. Fix conflicting best-of value for `ATK` vs `SRZ` in `2022-23 Season Database - 22-23 Season (5).csv` (C08 and part of C16).
4. Standardize player IDs for the five flagged names (C14).
5. Reconcile progression timeline anomalies for flagged playoff chains (C17/C18).
