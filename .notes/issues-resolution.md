# SQL Issues Resolution Notes

Date: 2026-02-05
Scope: `sql/issues.sql` issues `A` through `F`

## Issue A: Match ID collisions (4 teams in one game)

- Type: Root source-data issue.
- Root cause: Some source rows use minute-level timestamps (`HH:MM`), so concurrent matches in the same round can share one `Match ID`.
- What was fixed now:
  - Compare history queries now ignore malformed series with anything other than exactly 2 teams.
  - This avoids phantom pairings and impossible winner combinations in history output.
- What still cannot be safely auto-fixed:
  - Splitting one collided `Match ID` into the original two real matches is ambiguous without an authoritative external key.
- Recommended data fix:
  - Re-export source with second-level unique match identifiers, or add a stable match UUID column.

## Issue B: `series_id` collisions from timestamp stripping

- Type: Application query bug (fixable).
- Root cause: `series_id` derivation stripped `HHMMSS`, collapsing concurrent matches into one series.
- What was fixed now:
  - `seriesIdExpr` now only strips the game suffix (`-G#`) and preserves all timestamp/detail parts.
  - Insights queries in `server/src/insights-queries.ts` were updated to use the same safe rule.
- Expected result:
  - Concurrent matches no longer merge into one series; compare/profile/leaderboard series counts are more accurate.

## Issue C: `Victory = false` for both teams

- Type: Root source-data issue, partially recoverable in query logic.
- Root cause: Missing winner flag in source rows for some games.
- What was fixed now:
  - Compare history winner calculation now reconstructs game winners:
    - Uses exactly one `Victory=true` flag when present.
    - Falls back to higher team goals when both flags are false and goals are not tied.
    - Leaves game unresolved when ambiguous.
- What still remains:
  - Stored raw `Victory` values are unchanged in the database.
- Recommended data fix:
  - Backfill `Victory` from final score at ingest/export time for games with one clear higher score.

## Issue D: `Victory = true` for both teams

- Type: Downstream effect of Issue A (collided Match IDs), not an independent boolean parsing bug.
- What was fixed now:
  - Compare history winner reconstruction marks these games unresolved unless a single valid winner can be derived.
  - Collided/non-2-team series are excluded from history calculations.
- Recommended data fix:
  - Same as Issue A: ensure globally unique match identifiers in source.

## Issue E: Fractional/interpolated count stats

- Type: Root source-data quality/modeling issue.
- Root cause: Some non-OT rows still contain fractional values for count-like stats, indicating upstream interpolation/imputation.
- What was fixed now:
  - No code mutation applied to force rounding, to avoid fabricating values.
- Recommended data fix:
  - Prefer authoritative per-game integer event counts in source.
  - If upstream intentionally provides modeled values, document it explicitly and treat these columns as derived metrics.

## Issue F: Missing opponent team rows (single-team games)

- Type: Root source-data completeness issue.
- Root cause: Some games include rows for only one team.
- What was fixed now:
  - Compare history excludes malformed series that do not have exactly two teams.
  - Winner reconstruction requires exactly two teams per game before awarding a winner.
- What still remains:
  - Raw one-sided rows remain present and still affect raw aggregate totals outside history unless separately filtered.
- Recommended data fix:
  - Re-ingest corrected exports containing both teams for each game, or drop incomplete games at ingest with explicit audit logging.

## Code Changes Applied

- `server/src/utils/roster.ts`
  - Updated `seriesIdExpr` to preserve timestamp and only remove game suffix.
- `server/src/insights-queries.ts`
  - Replaced collision-prone series grouping expressions with `regexp_replace("Match ID", '-G[0-9]+$', '')`.
- `server/sql/compare/history_players.sql`
  - Added valid-series filter and robust game winner reconstruction.
- `server/sql/compare/history_rosters.sql`
  - Added valid-series filter and robust game winner reconstruction.
