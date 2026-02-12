# Data Integrity Report

Generated: 2026-02-12 15:29:39 UTC
Source command:

```bash
psql "postgres://stats:stats_pw@localhost:5432/statsdb" -P pager=off -A -F $'\t' -f sql/data-integrity.sql
```

Raw snapshot saved to: `out/data-integrity-latest.tsv`

## Summary

- Critical checks: `18`
- Critical passing: `11`
- Critical failing: `7`
- Warning checks: `3`
- Warning passing: `3`
- Warning failing: `0`

## Current Failing Checks

| Check ID | Severity | Metric Value | What it means |
|---|---:|---:|---|
| `C02_match_id_row_count_expected_3v3` | critical | `1` | One match does not have the expected 6 rows (3 players per team). |
| `C03_team_rows_per_match_expected_three` | critical | `1` | One match/team group does not have 3 player rows. |
| `C04_player_uniqueness_within_match_team` | critical | `1` | One match/team group has player identity shape issues. |
| `C14_player_name_unique_id_consistency` | critical | `2` | Two player names map to multiple unique IDs. |
| `C16_series_id_best_of_row_completeness` | critical | `6` | Six series fail best-of completeness/shape checks. |
| `C17_playoff_missing_followup_series_after_latest_win` | critical | `1` | One playoff progression case has a likely missing follow-up series. |
| `C18_playoff_bracket_depth_date_conflict` | critical | `4` | Four playoff pairs have deeper rounds dated before shallower rounds. |

## Key Identifiers

### Malformed match

- Match ID: `20230210-172301-2022-23-Winter-Cup-Groups-1-G3`
- Team with incomplete rows: `MYTHICX ESPORTS`

### Player ID drift

- `twnzr` -> `SSA-P-10148`, `SSA-P-10177`
- `lazybear` -> `SSA-P-10147`, `SSA-P-10174`

### Best-of completeness (`C16`) affected series IDs

- `240a74d87a25eb31cb042452d5f8a29f`
- `a7429661deac1f2e9fe47ebc2478e977`
- `c71695b54ee69bc674c141fc5c7e2881`
- `c92e36048114b9a5d80f40f25fcd380c`
- `cec425b7f5c2719f3dab08823078c5d3`
- `f280394ff670e0033315127c35c9f27e`

### Playoff anomaly (`C17`/`C18`) focus

Context:
- Season: `2024`
- Split: `Major 1`
- Regional: `Open Qualifier 1`

Teams:
- `LIMITLESS`
- `YOUNG MONEY CLAN`

Series IDs involved:
- `528d2998b536a299885741c22c5e7769` (later `QF`)
- `39c5880aca61eb5161c0e9ed50b00b2f` (`SF`)
- `4b4ca7f830e43e8803ccd00ac7ff6a68` (`GF`)
- `665968759df2dbdb38e9dda585c3142a` (`SF`)

## Important Passing Check

- `C19_match_ids_with_missing_series_id_rows`: `pass` (`0`)

This confirms the previous missing `series_id` outage is currently resolved.

## Recommended Next Work Order

1. Repair malformed match `20230210-172301-2022-23-Winter-Cup-Groups-1-G3`.
2. Normalize duplicate player IDs for `twnzr` and `lazybear`.
3. Investigate/patch playoff timeline anomalies for `LIMITLESS` and `YOUNG MONEY CLAN`.
4. Re-run full suite and confirm all critical checks pass.
