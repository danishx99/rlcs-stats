# Data Integrity Update (Non-Technical)

Date: 2026-02-12  
Source: latest run of `sql/data-integrity.sql` and `sql/series-id-preflight.sql`

## Executive Summary

The major `series_id` outage is fixed.  
Right now, all rows have series IDs again.

There are still data-quality problems to resolve before we can call this fully clean, including the progression anomaly you flagged (Limitless / Young Money Clan).

## What Was Fixed

### Series-linking (`series_id`) is restored

- Current status:
  - `11,734` total rows
  - `0` rows with null/blank `series_id`
  - `0` affected match IDs
- Historical incident (now resolved):
  - Previously, all `11,734` rows were missing `series_id`
  - Previously affected source files were:
    - `2024 Season Database - 2024 Major 1 (1).csv` (`5,784` rows)
    - `2022-23 Season Database - 22-23 Season (4).csv` (`3,712` rows)
    - `2026 Season Database - 2026 Boston Major.csv` (`2,238` rows)

## Remaining Issues (With Identifiers)

### 1) Malformed single match (row shape issue)

- Match ID:
  - `20230210-172301-2022-23-Winter-Cup-Groups-1-G3`
- Known symptom:
  - one side has incomplete rows (team: `MYTHICX ESPORTS`)

### 2) Player identity split across multiple IDs

- `twnzr` uses:
  - `SSA-P-10148`
  - `SSA-P-10177`
- `lazybear` uses:
  - `SSA-P-10147`
  - `SSA-P-10174`

### 3) Series completeness issues (best-of shape)

Affected series IDs:
- `240a74d87a25eb31cb042452d5f8a29f`
- `a7429661deac1f2e9fe47ebc2478e977`
- `c71695b54ee69bc674c141fc5c7e2881`
- `c92e36048114b9a5d80f40f25fcd380c`
- `cec425b7f5c2719f3dab08823078c5d3`
- `f280394ff670e0033315127c35c9f27e`

### 4) Progression anomaly (Limitless / Young Money Clan)

Flagged context:
- Season: `2024`
- Split: `Major 1`
- Regional: `Open Qualifier 1`

Latest win without expected follow-up recorded:
- Team: `LIMITLESS`
- Latest round seen: `QF`
- Series ID: `528d2998b536a299885741c22c5e7769`
- Date: `2024-03-02T17:03:00+00:00`

Depth/date conflicts found:
- `LIMITLESS`: `SF` (`39c5880aca61eb5161c0e9ed50b00b2f`, `2024-02-04T17:55:24+00:00`) appears before later `QF` (`528d2998b536a299885741c22c5e7769`, `2024-03-02T17:03:00+00:00`)
- `LIMITLESS`: `GF` (`4b4ca7f830e43e8803ccd00ac7ff6a68`, `2024-02-04T18:52:25+00:00`) appears before later `QF` (`528d2998b536a299885741c22c5e7769`, `2024-03-02T17:03:00+00:00`)
- `YOUNG MONEY CLAN`: `GF` (`4b4ca7f830e43e8803ccd00ac7ff6a68`, `2024-02-04T18:52:25+00:00`) appears before later `QF` (`528d2998b536a299885741c22c5e7769`, `2024-03-02T17:03:00+00:00`)
- `YOUNG MONEY CLAN`: `SF` (`665968759df2dbdb38e9dda585c3142a`, `2024-02-04T17:58:00+00:00`) appears before later `QF` (`528d2998b536a299885741c22c5e7769`, `2024-03-02T17:03:00+00:00`)

## Current Priority Order

1. Fix malformed match `20230210-172301-2022-23-Winter-Cup-Groups-1-G3`.
2. Resolve split player IDs (`twnzr`, `lazybear`).
3. Investigate and patch progression timeline anomaly for `LIMITLESS` / `YOUNG MONEY CLAN`.
4. Re-run full integrity checks and confirm all critical items pass.

## Exit Criteria

- `series_id` remains populated (`0` missing rows).
- No critical integrity failures remain.
- Limitless / Young Money Clan progression case is re-verified and documented as resolved.
