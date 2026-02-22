# Data Integrity Full Report

Generated: 2026-02-22 UTC
Database: `statsdb`
Input snapshot:
- `out/data-integrity-current.tsv`

## Executive Summary

Current run shows 22 total checks.

- Critical: 19 total (`18` pass, `1` fail)
- Warning: 3 total (`3` pass, `0` fail)
- Overall: `21` pass, `1` fail

Playoff progression integrity remains clean:
- `C17 = 0` (pass)
- `C18 = 0` (pass)

The only remaining issue is `C16` with two incomplete Bo7 fragments.

## Run Command

- `psql "${DATABASE_URL:-postgres://stats:stats_pw@localhost:5432/statsdb}" -P pager=off -A -F $'\t' -f "sql/data-integrity.sql" > "out/data-integrity-current.tsv"`

## Delta vs Prior Report (2026-02-21)

Reference: `.notes/data-integrity-full-report-2026-02-21.md`

What changed in `C16`:
- Still failing with value `2`.
- The prior duplicated-per-game inflation on `9e44866db7d869048b08d93defbf281d` is no longer present.
- Current state indicates a cleaner split across two series IDs:
  - one series has games `1-3`
  - another has game `4` only

## Current Failing Check

### `C16_series_id_best_of_row_completeness` (critical)

- Metric: `series_ids_with_best_of_shape_or_row_count_issues`
- Current value: `2` (threshold `0`)

Affected `series_id` records:

1. `35ba8061f15796b64f4020556fa2b332`
- `best_of=7`
- `min_required_games=4`
- `game_count=1`
- `game_numbers=[4]`
- `row_count=6`
- `team_count=2`, `match_count=1`
- Interpretation: orphan game 4 fragment for a Bo7.
- Match IDs:
  - `20220226-205000-2021-22-Winter-Regional Event 3-Playoffs-LQF-G4` — `ATK` vs `BOT GAMING`

2. `9e44866db7d869048b08d93defbf281d`
- `best_of=7`
- `min_required_games=4`
- `game_count=3`
- `game_numbers=[1,2,3]`
- `row_count=18`
- `team_count=2`, `match_count=3`
- `games_with_bad_row_count=0`
- Interpretation: games 1-3 fragment for the same Bo7 chain, missing game 4+ under this `series_id`.
- Match IDs:
  - `20220226-203500-2021-22-Winter-Regional Event 3-Playoffs-LQF-G1` — `ATK` vs `BOT GAMING`
  - `20220226-204000-2021-22-Winter-Regional Event 3-Playoffs-LQF-G2` — `ATK` vs `BOT GAMING`
  - `20220226-204500-2021-22-Winter-Regional Event 3-Playoffs-LQF-G3` — `ATK` vs `BOT GAMING`

## Full Check Matrix

| Check ID | Severity | Status | Metric | Value | Threshold |
|---|---|---|---|---:|---:|
| `C01_game_team_count_exactly_two` | critical | pass | `match_ids_with_team_count_not_2` | 0 | 0 |
| `C02_match_id_row_count_expected_3v3` | critical | pass | `match_ids_with_row_count_not_6` | 0 | 0 |
| `C03_team_rows_per_match_expected_three` | critical | pass | `match_team_groups_with_row_count_not_3` | 0 | 0 |
| `C04_player_uniqueness_within_match_team` | critical | pass | `match_team_groups_with_player_identity_issues` | 0 | 0 |
| `C05_exactly_one_winning_team_per_match` | critical | pass | `two_team_matches_with_winner_count_not_1` | 0 | 0 |
| `C06_team_level_victory_consistency` | critical | pass | `match_team_groups_with_mixed_victory_flags` | 0 | 0 |
| `C07_victory_vs_goals_consistency_non_tied` | critical | pass | `non_tied_two_team_matches_where_goal_winner_differs_from_victory_winner` | 0 | 0 |
| `C08_series_best_of_consistency` | critical | pass | `derived_series_keys_with_conflicting_best_of` | 0 | 0 |
| `C09_series_winner_threshold_coherence` | critical | pass | `derived_series_keys_with_impossible_winner_state` | 0 | 0 |
| `C10_issue_A_match_id_collisions` | critical | pass | `match_ids_with_more_than_2_teams` | 0 | 0 |
| `C11_issue_B_series_id_collision_risk` | critical | pass | `current_series_ids_with_more_than_2_teams` | 0 | 0 |
| `C12_issue_C_no_winner_matches` | critical | pass | `two_team_matches_with_zero_winners` | 0 | 0 |
| `C13_issue_D_double_winner_matches` | critical | pass | `two_team_matches_with_more_than_one_winner` | 0 | 0 |
| `C14_player_name_unique_id_consistency` | critical | pass | `player_names_with_multiple_unique_ids` | 0 | 0 |
| `C15_issue_F_single_team_matches` | critical | pass | `match_ids_with_single_team_only` | 0 | 0 |
| `C16_series_id_best_of_row_completeness` | critical | fail | `series_ids_with_best_of_shape_or_row_count_issues` | 2 | 0 |
| `C17_playoff_missing_followup_series_after_latest_win` | critical | pass | `playoff_teams_with_latest_series_win_but_no_recorded_followup` | 0 | 0 |
| `C18_playoff_bracket_depth_date_conflict` | critical | pass | `playoff_series_pairs_where_deeper_round_precedes_shallower_round` | 0 | 0 |
| `C19_match_ids_with_missing_series_id_rows` | critical | pass | `match_ids_with_null_or_blank_series_id_rows` | 0 | 0 |
| `W14_issue_E_fractional_counts_non_ot` | warning | pass | `player_rows_with_fractional_count_stats_in_non_ot` | 0 | 0 |
| `W16_dimensional_whitespace_variants` | warning | pass | `dimensions_with_outer_whitespace_variants` | 0 | 0 |
| `W17_case_variants_team_names` | warning | pass | `canonical_team_keys_with_case_variants` | 0 | 0 |

## Conclusion

- No new integrity failures were introduced.
- The most recent playoff progression issues remain fixed.
- Remaining work is focused and isolated: reconcile the split Bo7 chain for `ATK` vs `BOT GAMING` so `C16` reaches `0`.
