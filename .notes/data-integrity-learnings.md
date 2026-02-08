# Data Integrity Learnings

## Baseline Run
- Date: 2026-02-07
- Command:
  - `psql "postgres://stats:stats_pw@localhost:5432/statsdb" -P pager=off -f "sql/data-integrity.sql"`
- Dataset table: `stats`

## Result Summary
- Critical checks failed: 11 / 14
- Critical checks passed: 3 / 14
- Warning checks failed: 2 / 3
- Warning checks passed: 1 / 3
- Audit outcome (policy in `plans/data-integrity-check.md`): **FAIL**

## Key Failed Metrics
- `C01_game_team_count_exactly_two`: `598`
  - `Match ID`s where distinct team count is not 2.
- `C02_match_id_row_count_expected_3v3`: `717`
  - `Match ID`s where row count is not 6.
- `C03_team_rows_per_match_expected_three`: `284`
  - (`Match ID`, `Team`) groups not equal to 3 rows.
- `C04_player_uniqueness_within_match_team`: `296`
  - Match-team groups with missing/duplicate/non-3 player identities.
- `C05_exactly_one_winning_team_per_match`: `5`
  - Two-team matches with winner count not equal to 1.
- `C07_victory_vs_goals_consistency_non_tied`: `1`
  - Non-tied two-team match where goal winner != victory winner.
- `C08_series_best_of_consistency`: `1`
  - Derived series keys with conflicting `Best of` values.
- `C10_issue_A_match_id_collisions`: `5`
  - Raw `Match ID`s with more than two teams.
- `C11_issue_B_series_id_collision_risk`: `14`
  - Current series keys with more than two teams.
  - Additional context from check payload:
    - `legacy_collisions = 249`
    - `worst_legacy_team_count = 16`
    - `worst_current_team_count = 4`
- `C12_issue_C_no_winner_matches`: `5`
  - Two-team matches with zero winners.
- `C15_issue_F_single_team_matches`: `593`
  - `Match ID`s containing only one team.

## Passed Critical Checks
- `C06_team_level_victory_consistency`: `0`
- `C09_series_winner_threshold_coherence`: `0`
- `C13_issue_D_double_winner_matches`: `0`

## Warning Signals
- `W14_issue_E_fractional_counts_non_ot`: `0` (pass)
- `W16_dimensional_whitespace_variants`: `5` dimensions affected (fail)
  - Most affected: `Split` (1,566 rows with outer whitespace)
- `W17_case_variants_team_names`: `1` canonical key with case variants (fail)

## High-Impact Learnings
1. Structural completeness is the dominant failure mode.
- Most critical failures are missing rows/opponents rather than winner-flag corruption.

2. Current series keying is better than legacy but still exposed.
- Collision risk dropped significantly vs legacy behavior (`14` vs `249`), but not eliminated because source collisions still exist.

3. Winner flags are mostly coherent at row/team level.
- Team-level mixed victory flags were not observed (`C06` pass), so winner anomalies are sparse and localized.

4. Text hygiene issues are material.
- Outer whitespace in dimensions can fragment filters/aggregations and should be normalized upstream or at ingest.

## Next Integrity Iteration Priorities
1. Fix source-level match completeness (`C01`, `C02`, `C15`) before tuning series logic further.
2. Normalize dimension strings (`Split`, `Regional`, `Stage`, `Round`, `Team`) to reduce semantic duplicates.
3. Re-run full suite after each source refresh and track deltas per check ID.

## Update: Post-Normalization Reload (2026-02-07)
- Ingestion pipeline update landed in `src/load-csv.ts` for `stats` rows:
  - `TRIM` on `Split`, `Regional`, `Stage`, `Round`
  - `UPPER(TRIM(...))` on `Team`
- Full reload run with:
  - `bun run src/run.ts --dir ./data --truncate`
- Full audit rerun with:
  - `psql "postgres://stats:stats_pw@localhost:5432/statsdb" -P pager=off -f "sql/data-integrity.sql"`

### Result Delta
- `W16_dimensional_whitespace_variants`: `fail -> pass` (`0`)
- `W17_case_variants_team_names`: `fail -> pass` (`0`)
- `C11_issue_B_series_id_collision_risk`: `fail -> pass` (`0` current collisions)

### Remaining Critical Focus (Superseded by Update Below)
1. `C01/C10/C15`: malformed/collided match structures.
2. `C03/C04`: downstream team-row/player-shape anomalies caused by malformed structures.

## Update: Post Source-Fix Reload (2026-02-07)
- Source rows were corrected for the LE BOSH vs STR1VE ESPORTS LSF games and reloaded.
- Reload command:
  - `bun run src/run.ts --dir ./data --dataset matches --truncate`
- Integrity rerun command:
  - `psql "postgres://stats:stats_pw@localhost:5432/statsdb" -P pager=off -f "sql/data-integrity.sql"`

### Result Delta
- `C06_team_level_victory_consistency`: `fail -> pass` (`0`)
- `C08_series_best_of_consistency`: `fail -> pass` (`0`)
- `C15_issue_F_single_team_matches`: `fail -> pass` (`0`)
- `C01_game_team_count_exactly_two`: `12 -> 10`
- `C03_team_rows_per_match_expected_three`: `32 -> 30`
- `C04_player_uniqueness_within_match_team`: `44 -> 42`

### Current Remaining Critical Focus
1. `C01/C10`: remaining 4-team match-ID collisions.
2. `C03/C04`: downstream team-row/player-shape anomalies driven by those collisions.

## Update: Added Series BoN Completeness Check (2026-02-08)
- New critical check added to `sql/data-integrity.sql`:
  - `C16_series_id_best_of_row_completeness`
- Scope:
  - Groups by materialized `series_id`
  - Audits Bo3/Bo5/Bo7 series for:
    - game count in valid range (`ceil(best_of/2)` to `best_of`)
    - contiguous game numbers (starting at 1, no gaps)
    - consistent per-game 6-row shape (`row_count = game_count * 6`)
    - one match-id per game number in the series
- Initial run result:
  - `C16_series_id_best_of_row_completeness`: `fail` (`39` series)
