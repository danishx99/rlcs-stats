# Railway Memory Billing Root Cause (2026-04-17)

## Summary
Railway memory cost was dominated by two always-on services:
- API container: ~505 MB RSS (mostly anonymous JS heap)
- Postgres container: ~892 MB cgroup memory current, mostly file cache + shared memory

Observed in production via `railway ssh`:
- API `/sys/fs/cgroup/memory.current`: ~526 MB
- Postgres `/sys/fs/cgroup/memory.current`: ~892 MB

This aligns with billing math:
- 36,688 GB-min over ~17 days => ~1.50 GB average resident memory
- API + Postgres together are in that same range.

## Additional Findings
- Data is already clean for critical filter columns (`Unique ID`, `Team`, `Season`, `Split`, `Event`, `mode`, `scope`, `tier`): no leading/trailing whitespace in sampled production checks; no lowercase `Unique ID` values.
- Many hot queries still wrapped indexed columns in `LOWER(TRIM(...))` or `UPPER(TRIM(...))`, forcing expensive scans.
- Production logs showed recurring statement timeouts in heavy player/roster event-result queries.

## Code Changes Made
1. Replaced function-wrapped filter predicates with direct equality in hot paths:
   - `server/src/utils/filters.ts`
   - `server/src/routes/events.ts`
   - `server/sql/events/{top-teams,phases,days}.sql`
   - `server/sql/rosters/final-series.sql`
   - `server/sql/players/results.sql`
2. Normalized player IDs once at request boundary (trim + uppercase) to keep index-friendly equality:
   - `server/src/routes/players.ts`
3. Simplified player key expression to use canonical `"Unique ID"` directly:
   - `server/src/utils/roster.ts`
4. Simplified SSA filter to avoid wrapping column in functions:
   - `server/src/routes/stats.ts`
5. Lower-memory Bun runtime mode for API container:
   - `Dockerfile.api` now uses `bun --smol server/index.ts`

## Validation
- `bunx tsc -p server/tsconfig.json --noEmit` passes.
- `bun run build:web` passes.
- `bun run test` passes.

## Follow-up
- After deploy, re-check API/Postgres cgroup memory and billing usage trend over 24-48h.
- If memory remains high mainly due Postgres file cache, biggest cost lever is infra-level (sleep behavior or DB hosting strategy), not additional API code tweaks.
