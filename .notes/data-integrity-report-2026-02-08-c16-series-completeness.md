# Data Integrity Report: C16 Series BoN Row Completeness

Date: 2026-02-08  
Author: Codex  
Check ID: `C16_series_id_best_of_row_completeness`

## 0. Status Update (Post-Reload, 2026-02-08)
After source fixes and reload, this report's original baseline is superseded by the current state below.

Current C16 status:
- Scoped series evaluated: `1162`
- Failed series: `32`
- Passed series: `1130`
- Failure rate: `2.75%`

`Best of` conflict status (`r_best_of_variants`):
- Previous: `7` series
- Current: `0` series (resolved)

Current highest-priority remaining category:
- `r_below_required_games = 24` series
  - meaning Bo5/Bo7 series with fewer than required games (`< ceil(best_of/2)`).

Known interpretation caveat:
- `series_id` currently includes `Day`, which can split a real multi-game matchup into two series IDs if `Day` differs across games.
- Verified examples:
  - `ATK` vs `ORLANDO PIRATES` (`2021-22 Winter Regional Event 2 Playoffs UF`)
  - `NIXUH` vs `WHITE RABBIT GAMING` (`2022-23 Winter Invitational Playoffs QF`)
- Both have games `{1,2,3,4,5,6}` at pair+context level, but were split into `G1` vs `G2-G6` across two series IDs.
- Therefore:
  - series_id-based missing count: `24`
  - pair+context-based missing count: `22`

## 1. Objective
Assess whether each Bo3/Bo5/Bo7 series (grouped by materialized `series_id`) contains a structurally valid set of games and rows:
- enough games to reach a winner (`ceil(best_of/2)` minimum)
- no excess games (`<= best_of`)
- contiguous game numbering starting at 1
- exactly 6 rows per game (3 players x 2 teams)
- one `Match ID` per `(series_id, game_number)`

## 2. Data Scope and Execution
Scope:
- Table: `stats`
- Filter: `series_id IS NOT NULL AND "Best of " IN (3,5,7)`

Execution:
- Command used:  
  `psql "postgres://stats:stats_pw@localhost:5432/statsdb" -P pager=off -f "sql/data-integrity.sql"`
- Additional diagnostic SQL run in-session to break down failure reasons and distribution.

## 3. Headline Result
- Scoped series evaluated: `1042`
- Failed series: `39`
- Passed series: `1003`
- Failure rate: `3.74%`

Interpretation:
- Most series are structurally complete.
- A non-trivial minority still has missing games, numbering gaps, or duplicate game-row shapes.

## 4. Breakdown by Best-of
| Best of | Scoped | Failed | Passed | Failure % |
|---|---:|---:|---:|---:|
| 3 | 1 | 0 | 1 | 0.00% |
| 5 | 794 | 22 | 772 | 2.77% |
| 7 | 247 | 17 | 230 | 6.88% |

Observation:
- Bo7 has the highest failure rate (about 2.5x Bo5).

## 5. Failure Taxonomy (Reason Counts)
A series can fail multiple conditions; counts below are not mutually exclusive.

| Reason Flag | Count |
|---|---:|
| `r_below_required_games` | 24 |
| `r_non_contiguous_or_gap` | 13 |
| `r_min_not_one` | 10 |
| `r_best_of_variants` | 7 |
| `r_bad_game_row_shape` | 4 |
| `r_match_game_mismatch` | 4 |
| `r_row_count_mismatch` | 4 |
| `r_above_best_of` | 0 |
| `r_null_game_number` | 0 |
| `r_team_count` | 0 |

What this means:
- Primary issue is incomplete series coverage (too few games).
- Secondary issue is game numbering quality (starts late or has holes).
- Tertiary issue is duplicate row/match payloads for specific game numbers.

## 6. Failure Pattern Combinations
Top combinations among 39 failed series:

| Reason Combination | Series |
|---|---:|
| `below_required_games` | 18 |
| `best_of_variants only` | 7 |
| `min_not_one + non_contiguous_or_gap` | 5 |
| `below_required_games + min_not_one + non_contiguous_or_gap` | 4 |
| `below_required_games + row_count_mismatch + match_game_mismatch + bad_game_row_shape` | 1 |
| `below_required_games + non_contiguous_or_gap + row_count_mismatch + match_game_mismatch + bad_game_row_shape` | 1 |
| `min_not_one + non_contiguous_or_gap + row_count_mismatch + match_game_mismatch + bad_game_row_shape` | 1 |
| `non_contiguous_or_gap` | 1 |
| `non_contiguous_or_gap + row_count_mismatch + match_game_mismatch + bad_game_row_shape` | 1 |

## 7. Distribution of Failed Series
### By season
| Season | Failed series |
|---|---:|
| 2021-22 | 17 |
| 2022-23 | 10 |
| 2025 | 6 |
| 2024 | 4 |
| 2026 | 2 |

### By split
| Split | Failed series |
|---|---:|
| Winter | 17 |
| Spring | 7 |
| Birmingham Major | 4 |
| Major 1 | 4 |
| Fall | 3 |
| Boston Major | 2 |
| Raleigh Major | 2 |

### By stage
| Stage | Failed series |
|---|---:|
| Playoffs | 14 |
| GSL | 8 |
| Double Elim | 7 |
| Groups | 7 |
| Swiss | 3 |

## 8. Game Count Profile for Failed Series
| Best of | Game count | Series |
|---:|---:|---:|
| 5 | 1 | 4 |
| 5 | 2 | 15 |
| 5 | 3 | 2 |
| 5 | 4 | 1 |
| 7 | 1 | 4 |
| 7 | 3 | 1 |
| 7 | 4 | 7 |
| 7 | 5 | 3 |
| 7 | 6 | 1 |
| 7 | 7 | 1 |

Interpretation:
- Most Bo5 failures are 1-2 game series (under minimum required 3).
- Bo7 failures include both underfilled series and numbering/consistency anomalies even when game count is >= 4.

## 9. Notable Anomaly Classes with Examples
### A) Incomplete Bo5/Bo7 (below required game minimum)
- Example: `f05c413128aae181cbc39cc82f44386a` (Bo5, games `{1,2}`)
- Example: `72c83465854428860c19b0e5f2e35023` (Bo5, games `{1}`)

### B) Numbering starts late / missing early games
- Example: `13bcb30c39837ed7a8ef25f83df48a26` (Bo5, games `{2,3,4}`)
- Example: `6c9afee974c1e4d186a20c2ca91e4f16` (Bo5, games `{3}`)

### C) Non-contiguous numbering
- Example: `243e0170bc9e0b9134434959063cfbbd` (Bo5, games `{1,3}`)
- Example: `384e044e0524a4c34156850549c8ac6e` (Bo5, games `{1,2,4}`)

### D) Duplicate game payload (12 rows in one game number)
- Example: `53bd1f4fbe46495c633b5c29f277dcf5` (Bo5, game 5 has 12 rows)
- Example: `406ea6115977c0eecc0d3e54d40dfa7b` (Bo7, game 6 has 12 rows)

### E) Conflicting Best-of labels within one series_id
- 7 series have `best_of_values = {5,7}`.
- Example: `2986175bf86aa019d796fcea9c6ae754` (Spring 2021-22, LQF)
- Example: `cbee2413183265f9b5ba0ad8c47099c9` (Winter 2021-22, LQF)

## 10. What This Says About series_id Quality
Positive signal:
- `r_team_count = 0` and check `C11` is passing, so semantic `series_id` grouping is stable regarding team pairing.

Remaining risk:
- Series grouping is working, but source row completeness and in-series consistency are not fully reliable.

## 11. Impact
If unresolved, these failures can skew:
- series-level win/loss outcomes
- decider-game analytics
- Bo5/Bo7 conversion and clutch metrics
- any feature relying on complete game sequence per series

## 12. Recommended Remediation Plan
1. Resolve `best_of` conflicts first (`{5,7}` in same `series_id`) because they create ambiguous expected thresholds.
2. Backfill/fix missing games for `below_required_games` failures (largest bucket: 24).
3. Correct game numbering gaps and late starts (`min_not_one`, `non_contiguous_or_gap`).
4. Deduplicate game-level duplicates where a single `(series_id, game_number)` has 12 rows.
5. Re-run `sql/data-integrity.sql` and track `C16` trend after each batch.

## 13. Suggested Acceptance Criteria for Closure
- `C16_series_id_best_of_row_completeness` metric value = `0`.
- `best_of_variants` conflicts reduced to `0`.
- No series where `(series_id, game_number)` row count differs from `6`.
- No Bo5 below 3 games, no Bo7 below 4 games (unless explicitly classified and exempted by policy).

## 14. Appendix: Query Notes
Diagnostic report generated with temporary CTE-derived table (`c16_series_eval`) containing:
- per-series structure metrics (`game_count`, `row_count`, `match_count`, `game_numbers`)
- reason flags mirroring C16 predicates
- dimensions (`season`, `split`, `regional`, `stage`, `round`) and team pair for triage
