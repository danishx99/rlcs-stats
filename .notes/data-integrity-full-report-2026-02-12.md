# Data Integrity Full Report

Generated: 2026-02-13 11:25:50 UTC
Database: `statsdb`
Input snapshots:
- `out/data-integrity-current.tsv`
- `out/series-id-preflight-current.tsv`

## Executive Summary

Current run shows 22 total checks.

- Critical: 19 total (`15` pass, `4` fail)
- Warning: 3 total (`3` pass, `0` fail)

Series-linking status from preflight:
- Total `stats` rows: `28026`
- Rows with null/blank `series_id`: `0`
- Affected match IDs: `0`
- Affected source file: none

## Resolved Since Prior Report

- Issue 1 (incomplete/single-team Open 5 rows) remains resolved.
- Issue 2 (best-of conflict) is now resolved.
- These checks now pass: `C01`, `C02`, `C03`, `C04`, `C07`, `C08`, `C15`, `C19`.

## Failing Checks (Current)

- `C14_player_name_unique_id_consistency` (critical): `player_names_with_multiple_unique_ids = 6`
- `C16_series_id_best_of_row_completeness` (critical): `series_ids_with_best_of_shape_or_row_count_issues = 2`
- `C17_playoff_missing_followup_series_after_latest_win` (critical): `playoff_teams_with_latest_series_win_but_no_recorded_followup = 4`
- `C18_playoff_bracket_depth_date_conflict` (critical): `playoff_series_pairs_where_deeper_round_precedes_shallower_round = 6`

## Key Impacted Records

### Player name to Unique ID drift

- `Shadow` -> `SSA-P-10103`, `SSA-P-10128`
- `twnzr` -> `SSA-P-10148`, `SSA-P-10177`
- `pnda.` -> `SSA-P-10066`, `SSA-P-10084`
- `lazybear` -> `SSA-P-10147`, `SSA-P-10174`
- `Paarthurnax.` -> `SSA-P-10045`, `SSA-P-10101`
- `ckeno.` -> `SSA-P-10070`, `SSA-P-10110`

### Series shape/completeness issues (best-of expectations)

Affected `series_id` values:
- `6c9afee974c1e4d186a20c2ca91e4f16`
- `fc550c08025962e5910328450c36d4c4`

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
| `C01_game_team_count_exactly_two` | critical | pass | `match_ids_with_team_count_not_2` | 0 |
| `C02_match_id_row_count_expected_3v3` | critical | pass | `match_ids_with_row_count_not_6` | 0 |
| `C03_team_rows_per_match_expected_three` | critical | pass | `match_team_groups_with_row_count_not_3` | 0 |
| `C04_player_uniqueness_within_match_team` | critical | pass | `match_team_groups_with_player_identity_issues` | 0 |
| `C05_exactly_one_winning_team_per_match` | critical | pass | `two_team_matches_with_winner_count_not_1` | 0 |
| `C06_team_level_victory_consistency` | critical | pass | `match_team_groups_with_mixed_victory_flags` | 0 |
| `C07_victory_vs_goals_consistency_non_tied` | critical | pass | `non_tied_two_team_matches_where_goal_winner_differs_from_victory_winner` | 0 |
| `C08_series_best_of_consistency` | critical | pass | `derived_series_keys_with_conflicting_best_of` | 0 |
| `C09_series_winner_threshold_coherence` | critical | pass | `derived_series_keys_with_impossible_winner_state` | 0 |
| `C10_issue_A_match_id_collisions` | critical | pass | `match_ids_with_more_than_2_teams` | 0 |
| `C11_issue_B_series_id_collision_risk` | critical | pass | `current_series_ids_with_more_than_2_teams` | 0 |
| `C12_issue_C_no_winner_matches` | critical | pass | `two_team_matches_with_zero_winners` | 0 |
| `C13_issue_D_double_winner_matches` | critical | pass | `two_team_matches_with_more_than_one_winner` | 0 |
| `C14_player_name_unique_id_consistency` | critical | fail | `player_names_with_multiple_unique_ids` | 6 |
| `C15_issue_F_single_team_matches` | critical | pass | `match_ids_with_single_team_only` | 0 |
| `C16_series_id_best_of_row_completeness` | critical | fail | `series_ids_with_best_of_shape_or_row_count_issues` | 2 |
| `C17_playoff_missing_followup_series_after_latest_win` | critical | fail | `playoff_teams_with_latest_series_win_but_no_recorded_followup` | 4 |
| `C18_playoff_bracket_depth_date_conflict` | critical | fail | `playoff_series_pairs_where_deeper_round_precedes_shallower_round` | 6 |
| `C19_match_ids_with_missing_series_id_rows` | critical | pass | `match_ids_with_null_or_blank_series_id_rows` | 0 |
| `W14_issue_E_fractional_counts_non_ot` | warning | pass | `player_rows_with_fractional_count_stats_in_non_ot` | 0 |
| `W16_dimensional_whitespace_variants` | warning | pass | `dimensions_with_outer_whitespace_variants` | 0 |
| `W17_case_variants_team_names` | warning | pass | `canonical_team_keys_with_case_variants` | 0 |

## Priority Order to Resolve

1. Standardize player IDs for the six flagged names (`C14`).
2. Resolve remaining series completeness gaps for the two flagged `series_id` values (`C16`).
3. Reconcile progression timeline anomalies for flagged playoff chains (`C17`/`C18`).
