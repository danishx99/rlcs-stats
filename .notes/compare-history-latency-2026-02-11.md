# Compare History Latency Fix (2026-02-11)

## Problem
- `GET /api/compare/history?type=rosters` was slow because it rebuilt roster composition from raw `stats` rows for every request.
- The old query used very wide CTEs (`s.*`) and repeated large scans/materializations.

## Changes
- Added persisted `series_roster` table refreshed after stats ingest (`src/run.ts` -> `refreshSeriesRoster()` in `src/load-csv.ts`).
- Added indexes used by the new query path:
  - `idx_stats_series_team_game`
  - `series_roster_series_team_uq`
  - `idx_series_roster_roster_series_team`
  - `idx_series_roster_series_team`
- Rewrote `server/sql/compare/history_rosters.sql` to:
  - Start from selected roster IDs (`series_roster`) first.
  - Join to `stats` only for matched series IDs.
  - Preserve winner reconstruction behavior.
  - Return `total_count` and support SQL pagination (`LIMIT/OFFSET`).
- Updated `/api/compare/history` route to parse `limit/offset` and return `{ rows, total, limit, offset }`.
- Updated compare frontend to fetch paginated history from the API instead of slicing full results client-side.

## Validation
- Before: representative roster pair query was ~4.88s (`EXPLAIN ANALYZE`).
- After: same pair query is ~5.2ms (`EXPLAIN ANALYZE`) once `series_roster` is populated.

