# Data Integrity Report

Generated: 2026-02-13 11:25:50 UTC
Source command:

```bash
psql "postgres://stats:stats_pw@localhost:5432/statsdb" -P pager=off -A -F $'\t' -f sql/data-integrity.sql
```

Raw snapshot saved to: `out/data-integrity-current.tsv`

## Summary

- Critical checks: `19`
- Critical passing: `15`
- Critical failing: `4`
- Warning checks: `3`
- Warning passing: `3`
- Warning failing: `0`

## Issue Status (Requested Recheck)

- Issue 2 (`C08_series_best_of_consistency`): **resolved** (`0`, pass)
- Issue 3 (`C14_player_name_unique_id_consistency`): **not resolved** (`6`, fail)

## Current Failing Checks

| Check ID | Severity | Metric Value | What it means |
|---|---:|---:|---|
| `C14_player_name_unique_id_consistency` | critical | `6` | Six player names map to multiple unique IDs. |
| `C16_series_id_best_of_row_completeness` | critical | `2` | Two series fail best-of completeness checks. |
| `C17_playoff_missing_followup_series_after_latest_win` | critical | `4` | Four playoff team paths have likely missing follow-up series. |
| `C18_playoff_bracket_depth_date_conflict` | critical | `6` | Six playoff pairs have deeper rounds dated before shallower rounds. |

## Key Identifiers

### Player ID drift (`C14`)

- `Shadow` -> `SSA-P-10103`, `SSA-P-10128`
- `twnzr` -> `SSA-P-10148`, `SSA-P-10177`
- `pnda.` -> `SSA-P-10066`, `SSA-P-10084`
- `lazybear` -> `SSA-P-10147`, `SSA-P-10174`
- `Paarthurnax.` -> `SSA-P-10045`, `SSA-P-10101`
- `ckeno.` -> `SSA-P-10070`, `SSA-P-10110`

### Series IDs failing completeness (`C16`)

- `6c9afee974c1e4d186a20c2ca91e4f16`
- `fc550c08025962e5910328450c36d4c4`

## Recently Resolved

- `C07_victory_vs_goals_consistency_non_tied`: pass (`0`)
- `C08_series_best_of_consistency`: pass (`0`)
- `C01/C02/C03/C04/C15/C19`: pass (`0`)

## Recommended Next Work Order

1. Canonicalize player IDs for the six duplicated names (`C14`).
2. Resolve remaining `C16` series completeness cases.
3. Re-check playoff progression anomalies (`C17`/`C18`).
