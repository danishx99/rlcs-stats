# Data Integrity Focus Report: C17/C18 Playoff Progression

Date: 2026-02-17
Scope: Remaining playoff progression failures after prior integrity clean-up.
Command:
- `psql "postgres://stats:stats_pw@localhost:5432/statsdb" -P pager=off -A -F $'\t' -f "sql/data-integrity.sql" > "out/data-integrity-current.tsv"`

## What Changed in Logic
File updated: `sql/data-integrity.sql`

Change summary:
- Added playoff event-instance clustering for C17/C18 using a 7-day date-gap rule per `(season, split, regional)`.
- New CTE chain:
  - `playoff_series_catalog`
  - `playoff_series_instances_marked`
  - `playoff_series_instances`
  - `playoff_team_series_scoped`
- C17 latest-series detection now partitions by `(season, split, regional, event_instance_id, team)`.
- C18 bracket-order conflicts now compare rounds only within the same `event_instance_id`.

Why:
- Prevent false positives when the same `(season, split, regional)` labels are reused across different qualifier weekends.

## Result Delta

| Check | Before (2026-02-17 pre-patch) | After (2026-02-17 post-patch) | Delta |
|---|---:|---:|---:|
| C17_playoff_missing_followup_series_after_latest_win | 3 | 3 | 0 |
| C18_playoff_bracket_depth_date_conflict | 6 | 2 | -4 |

Interpretation:
- C18 had 4 cross-event false positives removed.
- Remaining 5 records (3 C17 rows + 2 C18 rows) look like true data issues or round-label anomalies.

## Grouped Remaining Issues

### Group A: Missing follow-up after latest playoff win (C17)
Pattern: team wins its latest recorded non-GF playoff series in an event instance, but no subsequent series is present.

Count: 3 teams / 3 series

| Team | Opponent | Season/Split/Regional | Event Instance | Latest Round | Latest Series | Date (UTC) | Estimated Series Score |
|---|---|---|---:|---|---|---|---|
| BOT GAMING | YANKEES WITH NO BRIM | 2021-22 / Winter / Regional Event 3 | 1 | LR2 | `15c45f6ae29788dce047ec6c3f310547` | 2022-02-26 17:25:34 | 3-0 (Bo5) |
| LIMITLESS | YOUNG MONEY CLAN | 2024 / Major 1 / Open Qualifier 1 | 2 | QF | `528d2998b536a299885741c22c5e7769` | 2024-03-02 17:03:00 | 4-0 (Bo7) |
| TRADUIS SI TU PUES | GENESIX | 2025 / Raleigh Major / Open 6 | 1 | LR1 | `5c1a359af90b538504de8aea21b01459` | 2025-05-24 18:33:37 | 4-1 (Bo7) |

Relevant match IDs (Issue 1 only):

- `15c45f6ae29788dce047ec6c3f310547` (BOT GAMING vs YANKEES WITH NO BRIM)
  - `20220226-170654-2021-22-Winter-Regional Event 3-Playoffs-LR2-G1`
  - `20220226-171625-2021-22-Winter-Regional Event 3-Playoffs-LR2-G2`
  - `20220226-172534-2021-22-Winter-Regional Event 3-Playoffs-LR2-G3`
- `528d2998b536a299885741c22c5e7769` (LIMITLESS vs YOUNG MONEY CLAN)
  - `20240302-17.00-2024-Major 1-Open Qualifier 1-Playoffs-QF-G1`
  - `20240302-17.01-2024-Major 1-Open Qualifier 1-Playoffs-QF-G2`
  - `20240302-17.02-2024-Major 1-Open Qualifier 1-Playoffs-QF-G3`
  - `20240302-17.03-2024-Major 1-Open Qualifier 1-Playoffs-QF-G4`
- `5c1a359af90b538504de8aea21b01459` (TRADUIS SI TU PUES vs GENESIX)
  - `20250524-180116-2025-Raleigh Major-Open 6-Playoffs-LR1-G1`
  - `20250524-180857-2025-Raleigh Major-Open 6-Playoffs-LR1-G2`
  - `20250524-181559-2025-Raleigh Major-Open 6-Playoffs-LR1-G3`
  - `20250524-182338-2025-Raleigh Major-Open 6-Playoffs-LR1-G4`
  - `20250524-183337-2025-Raleigh Major-Open 6-Playoffs-LR1-G5`

Likely root cause bucket:
- Source completeness gaps (missing later-round rows for those team paths).

Confirmed note:
- For `BOT GAMING` after `LR2` (`15c45f6ae29788dce047ec6c3f310547`), the missing follow-up series is:
  - `ATK` vs `BOT GAMING`
  - Outcome context: FF win for `ATK`
- For `LIMITLESS` (`528d2998b536a299885741c22c5e7769`), this appears to be a data-labeling issue:
  - Two distinct playoff instances are both labeled `2024 / Major 1 / Open Qualifier 1`.
  - Instance A: 2024-02-03 to 2024-02-04 (`QF/SF/GF` chain ending in `LIMITLESS vs YOUNG MONEY CLAN` GF).
  - Instance B: 2024-03-02 (`QF` only, `LIMITLESS vs YOUNG MONEY CLAN`).
  - Instance B match IDs:
    - `20240302-17.00-2024-Major 1-Open Qualifier 1-Playoffs-QF-G1`
    - `20240302-17.01-2024-Major 1-Open Qualifier 1-Playoffs-QF-G2`
    - `20240302-17.02-2024-Major 1-Open Qualifier 1-Playoffs-QF-G3`
    - `20240302-17.03-2024-Major 1-Open Qualifier 1-Playoffs-QF-G4`
  - Recommended correction: relabel one instance to the correct qualifier/event name so progression checks evaluate within the right bracket.
- For `TRADUIS SI TU PUES` (`5c1a359af90b538504de8aea21b01459`):
  - This is an `LR1` Bo7 win (`4-1`) over `GENESIX` on 2025-05-24.
  - In the same event instance, `TRADUIS SI TU PUES` does not appear in any later playoff series.
  - Confirmed missing follow-up: `HEY (WITH RIZZ)` vs `TRADUIS SI TU PUES` (FF win for `HEY (WITH RIZZ)`) is not recorded.

Fix direction:
- Validate source exports for these exact events and backfill missing follow-up series rows.

### Group B: Bracket depth timeline conflicts (C18)
Pattern: deeper playoff round appears earlier than shallower round for the same team in the same event instance.

Count: 2 pair-conflicts (both tied to BOT GAMING in one event instance)

| Team | Context | Event Instance | Deeper Round (earlier date) | Shallower Round (later date) |
|---|---|---:|---|---|
| BOT GAMING | 2021-22 / Winter / Regional Event 3 | 1 | LQF on 2022-02-25 17:15:00 (`9e44866db7d869048b08d93defbf281d`) | LR1 on 2022-02-25 19:56:29 (`8cb3f99361af1d3ef6333914a9c6a5c9`) |
| BOT GAMING | 2021-22 / Winter / Regional Event 3 | 1 | LQF on 2022-02-25 17:15:00 (`9e44866db7d869048b08d93defbf281d`) | LR2 on 2022-02-26 17:25:34 (`15c45f6ae29788dce047ec6c3f310547`) |

Likely root cause bucket:
- Either round labels are inconsistent with bracket semantics, or timestamps/series ordering are incorrect for this chain.

Fix direction:
- Manually audit BOT GAMING playoff path in source bracket references and correct one of:
  - round labels (`LQF`/`LR1`/`LR2`), or
  - match timestamps.

## False Positives Removed by New Scoping
Previously flagged but removed from C18 after instance scoping:
- LIMITLESS (SF/GF on 2024-02-04 vs QF on 2024-03-02)
- YOUNG MONEY CLAN (GF/SF on 2024-02-04 vs QF on 2024-03-02)

These are now separated into different `event_instance_id` values and no longer compared as one bracket timeline.

## Priority Fix Queue (Grouped)
1. Group A (source completeness):
- Backfill missing follow-up playoff series for:
  - `15c45f6ae29788dce047ec6c3f310547`
  - `528d2998b536a299885741c22c5e7769`
  - `5c1a359af90b538504de8aea21b01459`

2. Group B (round-order semantics):
- Resolve BOT GAMING round/date contradiction for:
  - `9e44866db7d869048b08d93defbf281d`
  - `8cb3f99361af1d3ef6333914a9c6a5c9`
  - `15c45f6ae29788dce047ec6c3f310547`

## Acceptance Target
- `C17` metric value = `0`
- `C18` metric value = `0`
- Full suite remains with no additional critical regressions.
