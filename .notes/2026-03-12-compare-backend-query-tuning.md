# Compare Backend Query Tuning (2026-03-12)

## Why
The compare page intermittently returned `Failed to load comparison data.` and felt slow. Backend review showed:
- `compare_players.sql` scanned broadly and re-scanned via a correlated subquery for team history.
- Player compare-history pagination happened in Node (`rows.slice(...)`) after fetching all rows.

## Changes
- Reworked `server/sql/compare/compare_players.sql`:
  - Filter to selected player IDs at the first CTE.
  - Replace correlated team-history subquery with a pre-aggregated `player_teams` CTE.
- Reworked `server/sql/compare/history_players.sql`:
  - Added SQL-side paging (`LIMIT/OFFSET`) and `total_count` in-query.
- Updated `server/src/routes/compare.ts`:
  - Pass new SQL params for players history pagination.
  - Read `total_count` from SQL rows.
  - Enforce max compare IDs (`6`) to match UI bounds and avoid pathological query fan-out.

## Local Validation
- Type check: `bunx tsc -p server/tsconfig.json --noEmit`
- Web build: `bun run build:web`
- SQL behavior validated against local Postgres sample dataset.

## Measured Impact (local EXPLAIN ANALYZE, hot players sample)
- Player compare query dropped from ~806 ms to ~96 ms.

## Follow-up
- Remaining hotspot risk: predicates use `NULLIF(TRIM("Unique ID"), '')`, which can bypass plain index usage on `"Unique ID"`.
- Consider adding expression index in migration/bootstrapping path:
  - `CREATE INDEX IF NOT EXISTS idx_stats_unique_id_trim ON stats ((NULLIF(TRIM("Unique ID"), '')));`

## Additional Compare Stats Tuning (2026-03-13)
- `compare_rosters.sql` no longer rebuilds roster CTEs from full `stats` on every call.
- It now joins selected `series_roster` rows directly to `stats`, then aggregates.
- Join condition changed from `TRIM(team)` matching to exact `s."Team" = sr.team` so the existing `idx_stats_series_team_game` index can be used.
- `handleCompare` now resolves stat options once per request (`getAllStatOptions`) instead of invoking async key resolution per metric.
