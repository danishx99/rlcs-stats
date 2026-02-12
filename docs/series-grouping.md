# Series Grouping

How individual game rows in the `stats` table are grouped into series (best-of-N matches between two teams).

## Definition

A **series** is a set of games sharing canonical match metadata and canonical team pair:

```
series_id = md5(season | split | regional | day | stage | round | best_of | team_a | team_b)
```

Where:

- `team_a = LEAST(team_norm_1, team_norm_2)`
- `team_b = GREATEST(team_norm_1, team_norm_2)`
- `team_norm = UPPER(TRIM("Team"))`

Team normalization makes the key case-insensitive and order-independent.

The result is a 32-character hex string stored as `stats.series_id`.

## Why not derive from Match ID?

The previous approach stripped the game suffix from Match ID via regex (`regexp_replace("Match ID", '-G[0-9]+$', '')`). This had two problems:

1. **Format-dependent** — assumed a specific Match ID structure that could change across data sources.
2. **Collisions** — concurrent matches sharing a timestamp prefix (but involving different teams) collapsed into one "series." This affected 14 series with >2 teams.

The semantic approach is format-independent and produces zero multi-team collisions by construction — the team pair is part of the key.

## Materialized column

`series_id` is a materialized column on `stats`, not a computed expression. This is necessary because discovering the opponent team requires a self-join (each row only knows its own team), which can't be expressed as a single-column SQL expression. Materialization also:

- Simplifies all downstream queries (just reference `s.series_id`)
- Enables direct indexing (`idx_stats_series_id`)
- Eliminates repeated regex computation

## NULL values

Rows get `series_id = NULL` when:

| Reason | Description |
|--------|-------------|
| Single-team match | Match ID has only 1 distinct canonical team (no opponent to pair with) |
| Collided match | Match ID has >2 distinct canonical teams (ambiguous pairing) |

The exact NULL count depends on the current dataset contents.

## How it's computed

### During data load

After all CSV files are ingested, `computeSeriesIds()` in `src/load-csv.ts` runs an UPDATE scoped to `WHERE series_id IS NULL`. This handles cross-file series (games from the same series split across CSV files) and only runs when the `stats` dataset is loaded.

### Migration for existing data

For databases that predate the column:

```bash
psql postgres://stats:stats_pw@localhost:5432/statsdb -v ON_ERROR_STOP=1 -P pager=off -f sql/series-id-preflight.sql
psql postgres://stats:stats_pw@localhost:5432/statsdb -v ON_ERROR_STOP=1 -f sql/migrate-series-id.sql
```

Shortcut scripts:

```bash
bun run series:preflight
bun run series:backfill
```

The migration runs in one transaction (`BEGIN ... COMMIT`) and includes a hard assertion that fails if any `stats.series_id` remains NULL/blank. If that assertion fails, the whole transaction is rolled back.

### Algorithm

1. Build a base set with normalized teams (`UPPER(TRIM("Team"))`) and metadata.
2. Find distinct `(Match ID, team_norm)` pairs and keep only Match IDs with exactly 2 canonical teams.
3. Compute canonical pair `team_a/team_b` via `LEAST/GREATEST(team_norm)`.
4. Canonicalize metadata per Match ID (`MIN` for season/split/regional/day/stage/round and `MAX` for `Best of`).
5. Build the key: `season|split|regional|day|stage|round|best_of|team_a|team_b`.
6. Hash with `md5()` and write to `stats.series_id`.

## Usage in queries

Server SQL templates and insight queries reference the column directly. Query paths that require valid series grouping should also filter out NULLs:

```sql
-- Count series played
COUNT(DISTINCT s.series_id)

-- Group by series
GROUP BY s.series_id

-- Filter out ungroupable rows
WHERE s.series_id IS NOT NULL
```

## Implementation

- **Schema:** `src/stats-schema.ts` — column definition + comment
- **Loader:** `src/load-csv.ts` — `computeSeriesIds()` backfill function
- **Runner:** `src/run.ts` — calls `computeSeriesIds` after ingestion; adds column + index on startup
- **Migration:** `sql/migrate-series-id.sql` — transactional backfill for existing databases
- **Preflight:** `sql/series-id-preflight.sql` — current coverage/impact snapshot before and after backfill
- **Server queries:** All SQL templates in `server/sql/` reference `s.series_id` directly
- **Index:** `idx_stats_series_id` on `stats(series_id)`

## Verification

```sql
-- Coverage
SELECT COUNT(*) AS total, COUNT(series_id) AS with_id, COUNT(*) - COUNT(series_id) AS null_id FROM stats;

-- No multi-team non-NULL series: expect 0 rows
SELECT series_id, COUNT(DISTINCT UPPER(TRIM("Team"))) AS teams
FROM stats WHERE series_id IS NOT NULL
GROUP BY series_id HAVING COUNT(DISTINCT UPPER(TRIM("Team"))) > 2;

-- Match IDs should map to at most one non-NULL series_id
SELECT "Match ID"
FROM stats
GROUP BY "Match ID"
HAVING COUNT(DISTINCT series_id) FILTER (WHERE series_id IS NOT NULL) > 1;

-- Distinct series count
SELECT COUNT(DISTINCT series_id) FROM stats WHERE series_id IS NOT NULL;
```

For a consolidated check report, run:

```bash
psql postgres://stats:stats_pw@localhost:5432/statsdb -v ON_ERROR_STOP=1 -f sql/verify-series-grouping.sql
```

## Recovery Runbook

If `series_id` unexpectedly appears cleared:

1. Run preflight:
   ```bash
   psql postgres://stats:stats_pw@localhost:5432/statsdb -v ON_ERROR_STOP=1 -P pager=off -f sql/series-id-preflight.sql
   ```
2. Run atomic backfill:
   ```bash
   psql postgres://stats:stats_pw@localhost:5432/statsdb -v ON_ERROR_STOP=1 -f sql/migrate-series-id.sql
   ```
3. Re-run preflight and confirm `null_or_blank_series_id_rows = 0`.
