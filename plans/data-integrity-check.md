# Data Integrity Check Runbook

## Purpose
Run a repeatable, audit-only integrity check over the `stats` table to detect structural and winner-consistency issues in RLCS match data.

This check does **not** mutate data and does **not** block ingestion yet. It is used to decide whether a dataset passes integrity standards.

## Files
- SQL suite: `sql/data-integrity.sql`
- Baseline learnings: `.notes/data-integrity-learnings.md`

## How To Run
Use local `DATABASE_URL` or direct connection string.

```bash
psql "$DATABASE_URL" -P pager=off -f "sql/data-integrity.sql"
```

Example:

```bash
psql "postgres://stats:stats_pw@localhost:5432/statsdb" -P pager=off -f "sql/data-integrity.sql"
```

## Output Contract
The SQL returns one row per check with columns:
- `check_id`
- `severity` (`critical` or `warning`)
- `status` (`pass` or `fail`)
- `metric_name`
- `metric_value`
- `threshold`
- `sample_json` (example offenders)

## Decision Policy
- Audit **fails** if any `critical` check has `status = fail`.
- Audit **passes with warnings** if only `warning` checks fail.
- Audit **passes cleanly** if all checks pass.

This policy is for audit/reporting only. Ingestion behavior is unchanged.

## Check Catalog
| Check ID | Severity | What it validates | Related issue(s) |
|---|---|---|---|
| `C01_game_team_count_exactly_two` | critical | Each `Match ID` has exactly 2 teams | A, F |
| `C02_match_id_row_count_expected_3v3` | critical | Each `Match ID` has 6 rows for 3v3 | A, F |
| `C03_team_rows_per_match_expected_three` | critical | Each (`Match ID`, `Team`) has 3 rows | F |
| `C04_player_uniqueness_within_match_team` | critical | Three unique players per team per match | F |
| `C05_exactly_one_winning_team_per_match` | critical | Exactly one winning team per 2-team match | C, D |
| `C06_team_level_victory_consistency` | critical | Team rows agree on victory flag | C, D |
| `C07_victory_vs_goals_consistency_non_tied` | critical | Winner flag aligns with non-tied goals | C |
| `C08_series_best_of_consistency` | critical | Derived series has stable `Best of` | B |
| `C09_series_winner_threshold_coherence` | critical | Series winner threshold logic is coherent | B, C, F |
| `C10_issue_A_match_id_collisions` | critical | Raw `Match ID` contains >2 teams | A |
| `C11_issue_B_series_id_collision_risk` | critical | Current/legacy series key collision risk | B |
| `C12_issue_C_no_winner_matches` | critical | 2-team matches with zero winners | C |
| `C13_issue_D_double_winner_matches` | critical | 2-team matches with >1 winners | D |
| `W14_issue_E_fractional_counts_non_ot` | warning | Fractional count stats in non-OT rows | E |
| `C15_issue_F_single_team_matches` | critical | `Match ID` with only one team | F |
| `C16_series_id_best_of_row_completeness` | critical | For Bo3/Bo5/Bo7 series_id groups: valid game count, contiguous game numbers, and 6 rows per game | series-id / completeness |
| `W16_dimensional_whitespace_variants` | warning | Trailing/leading whitespace in dimensions | data hygiene |
| `W17_case_variants_team_names` | warning | Same team represented by case variants | data hygiene |

## Remediation Guide
If these fail, use this order:
1. `C01`, `C15`, `C10`: Fix malformed/collided match groups in source exports first.
2. `C02`-`C04`: Restore complete 3v3 row shape (6 rows/match, 3 per team, 3 unique players).
3. `C05`, `C07`, `C12`, `C13`: Correct `Victory` flags using authoritative match outcomes.
4. `C08`, `C09`, `C11`: Rebuild series grouping after structural fixes; avoid timestamp-only heuristics.
5. `C16`: Validate Bo3/Bo5/Bo7 series-id completeness (minimum required games, contiguous numbering, 6 rows per game).
6. `W16`, `W17`: Normalize text dimensions (`TRIM`, case canonicalization) in source or ingest pre-processing.

## Baseline Workflow
After each major dataset refresh:
1. Run `sql/data-integrity.sql`.
2. Record key check outputs in `.notes/data-integrity-learnings.md`.
3. Compare against previous baseline and note trend directions (`up`/`down` for failures).

## Notes
- This suite intentionally audits by raw `Match ID` for 3v3 shape checks because that is the unit used to encode a game row set.
- Derived series checks (`C08`, `C09`) use metadata + team pairing and are audit signals, not authoritative source truth.
