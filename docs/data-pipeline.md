# Data Ingestion Pipeline

The data pipeline reads CSV files from disk, coerces and transforms each row, and bulk-inserts them into PostgreSQL. It is orchestrated by `src/run.ts` and produces a JSON report at `out/import-report.json`.

## How to Run

```bash
bun run src/run.ts --dir ./data          # ingest all CSVs under data/
bun run load                             # same, via npm script
```

### CLI Flags

| Flag | Default | Description |
|------|---------|-------------|
| `--dir <path>` | `./data` | Root directory containing dataset subdirectories |
| `--pattern <glob>` | `*.csv` | Filename glob to match within each dataset subdirectory |
| `--limit <n>` | none | Stop after `n` rows per file (disables file-ingest tracking and series_id backfill) |
| `--dry-run` | `false` | Parse and validate without writing to the database |
| `--strict` | `false` | Throw on the first coercion error instead of logging and continuing |
| `--truncate` | `false` | `TRUNCATE` target tables and `file_ingest` before loading |
| `--allow-new-columns` | `false` | Auto-add CSV columns not in the schema as `TEXT` instead of failing |
| `--dataset <key>` | `all` | Load only one dataset: `matches` or `players` |

## Pipeline Stages

The pipeline runs the following steps in order:

### 1. Connect to PostgreSQL

Uses `DATABASE_URL` env var if set, otherwise constructs a connection string from `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` (defaults: `localhost:5432/statsdb`, `stats/stats_pw`).

### 2. Ensure Schema

For each dataset, runs in order:
1. `CREATE TABLE IF NOT EXISTS` (from `stats-schema.ts` or `players-schema.ts`)
2. `ADD COLUMN IF NOT EXISTS` for any additional columns (players dataset)
3. Add ingestion columns: `source_file TEXT`, `ingested_at TIMESTAMPTZ`
4. Add `row_hash TEXT` column
5. Apply column comments (SQL `COMMENT ON COLUMN`)
6. Create unique index on `row_hash`
7. (stats only) Add `series_id TEXT` column and index

### 3. Truncate (optional)

If `--truncate` is passed and not in dry-run mode:
- `TRUNCATE <table> RESTART IDENTITY` for each dataset table
- If all datasets are selected, also truncates `file_ingest`; otherwise deletes only matching `file_ingest` rows

### 4. Discover Files

For each dataset, lists files in `<dir>/<dataSubdir>/` matching the glob pattern. Files are processed in directory-listing order.

### 5. File-Level Deduplication

Before processing a file, the loader computes its SHA-256 hash and checks the `file_ingest` table for a matching `(table_name, file_hash)` pair. If found, the file is skipped entirely. This check is bypassed when `--limit` is set.

### 6. Load CSV Rows

Each file is streamed row-by-row using `csv-parse` (via `src/util/csv.ts`). On the first row:

1. **Header normalization** — The players dataset applies alias mapping (e.g., `playerid` → `Player ID`, `photourl` → `Photo URL`). The matches dataset uses headers as-is.
2. **Header truncation** — The players dataset stops at the `Photo URL` column, discarding anything after it.
3. **Empty header filtering** — Columns with blank headers are dropped.
4. **Duplicate detection** — Throws if normalized headers contain duplicates.
5. **Unknown column check** — Columns not in the schema either cause an error (default) or are auto-added as `TEXT` (`--allow-new-columns`).
6. **Synthetic Forfeit injection** — If the CSV has a `Victory` column but no `Forfeit` column, a synthetic `Forfeit` column is appended. Its value is `true` when the raw `Victory` value is `"ff"`, `false` otherwise.

For each data row:
1. Blank rows (all values empty) are silently skipped.
2. Values are coerced to their schema types (see [Type Coercion](#type-coercion)).
3. Stats-table text normalization is applied (see [Data Transformations](#data-transformations)).
4. OT denormalization is applied if enabled (see [OT Denormalization](#ot-denormalization)).
5. A SHA-256 `row_hash` is computed from all coerced values.
6. The row is added to the current batch.

Rows are inserted in batches via multi-row `INSERT ... ON CONFLICT (row_hash) DO NOTHING`. Batch size is calculated as `floor(65000 / (column_count + 2))` to stay under PostgreSQL's 65535 parameter limit.

### 7. Record File Ingest

After successfully processing a file (not in dry-run or limit mode), a row is inserted into `file_ingest` with the file name, SHA-256 hash, size, and row counts.

### 8. Series ID Backfill

After all files are loaded (not in dry-run mode, stats dataset was processed), `computeSeriesIds()` runs a single SQL statement that backfills `series_id` for any rows where it is `NULL`. See [Series ID](#series-id).

### 9. Write Report

Aggregates per-file reports into `out/import-report.json` with totals for `totalRows`, `inserted`, `skipped`, and `errored`.

## Datasets

Two datasets are configured in `src/datasets.ts`:

| Property | `matches` | `players` |
|----------|-----------|-----------|
| Table | `stats` | `players` |
| Data subdirectory | `data/matches/` | `data/players/` |
| Schema file | `src/stats-schema.ts` | `src/players-schema.ts` |
| Header normalizer | none | Alias mapping (camelCase/lowercase → canonical) |
| Stop after header | none | `Photo URL` |
| Ignore coercion errors | `false` | `true` |
| OT denormalization | `true` | `false` |

## Deduplication

The pipeline deduplicates at two levels:

### File-Level

Each CSV file is hashed with SHA-256. Before processing, the hash is checked against `file_ingest(table_name, file_hash)`. If the file was already ingested, it is skipped. This prevents re-processing the same file across multiple runs.

### Row-Level

Each row's coerced values are concatenated with a `\x1f` (unit separator) delimiter, with `NULL` values represented as `<NULL>`. The concatenated string is SHA-256 hashed to produce `row_hash`. The `INSERT` uses `ON CONFLICT (row_hash) DO NOTHING`, so duplicate rows within or across files are silently skipped.

## Type Coercion

Every raw CSV string is coerced based on the column's declared type:

| Type | Behavior |
|------|----------|
| `TEXT` | Returned as-is |
| `INTEGER` | `parseInt(value, 10)` — returns `null` with error on `NaN` |
| `DOUBLE PRECISION` | `parseFloat(value)` — returns `null` with error on `NaN` |
| `BOOLEAN` | Truthy: `true`, `t`, `1`, `yes`, `y`. Falsy: `false`, `f`, `0`, `no`, `n`, `ff`. Anything else errors. |
| `TIMESTAMPTZ` | Parsed via `parseDateString()` (see below) |

**Null handling:** Empty strings, `"na"`, `"n/a"`, and `"null"` (case-insensitive) all coerce to `null`.

### Date Parsing (`TIMESTAMPTZ`)

The `parseDateString()` function handles multiple date formats:

1. **ISO-like** (`2021-10-22T17:00`) — dot-separated times are normalized (`T17.00` → `T17:00`). If no timezone is present, `Z` (UTC) is appended.
2. **Ambiguous D/M/Y** (`22/10/2021`, `10-22-2021`) — if the first number is >12 it's treated as day; otherwise, the second number that's >12 is treated as day. Falls back to M/D/Y when ambiguous.
3. **Fallback** — anything else is passed to `new Date()` with UTC assumed if no timezone is present.

## Data Transformations

### Text Normalization (stats table only)

Applied after coercion to stats-table TEXT columns:

- **Team** — trimmed and uppercased
- **Split, Event, Stage, Round** — trimmed; empty strings become `null`
- All other TEXT columns — unchanged

### Synthetic Forfeit Column

If the CSV contains a `Victory` column but no `Forfeit` column, the loader injects a synthetic `Forfeit` boolean. It is `true` when the raw `Victory` value is exactly `"ff"` (case-insensitive), `false` otherwise.

### OT Denormalization

The source data normalizes certain count-based stats to a 300-second (5-minute) regulation game. For overtime games this produces fractional values like `0.83 goals`. The loader reverses this normalization to recover actual counts.

**Formula:** `value = round(value * (300 + Extra Time) / 300)`

This is applied only when:
- The dataset has `denormalize: true` (matches only)
- The row has `OT = true` and `Extra Time > 0`
- The column is a numeric value in the denormalization set

**Affected stats** (each with 4 zone suffixes: `_All Zones`, `_Defense Zone`, `_Neutral Zone`, `_Offense Zone`):

Goals, Assists, Saves, Shots, Score, Kills, Deaths, Passes Given, Passes Received, 50/50s, Possession Losses, Interceptions, Self Touches, Small Pads Collected, Big Boosts Collected, Ball Touches

## Series ID

After all rows are inserted, the pipeline runs a SQL backfill to compute `series_id` for any stats rows where it is still `NULL`. The series ID groups all games within a single best-of series between two teams.

### Hash Formula

```
series_id = md5(Season|Split|Event|Day|Stage|Round|Best of|team_a|team_b)
```

Where `team_a` and `team_b` are the two distinct team names (uppercased, trimmed) sorted alphabetically using `LEAST`/`GREATEST`. The pipe `|` character is the literal delimiter.

### When series_id Stays NULL

- The match has fewer or more than exactly 2 distinct teams (e.g., single-team test data, or data errors with >2 teams)
- The row has not yet been backfilled (only rows with `series_id IS NULL` are updated)

For more details on series grouping, see [docs/series-grouping.md](./series-grouping.md).

## Database Schema

### `stats` Table

~284 columns. Each row represents one player's performance in one game.

**Key columns:**

| Column | Type | Description |
|--------|------|-------------|
| `id` | `BIGSERIAL` | Primary key |
| `Player Name` | `TEXT` | Display name |
| `Unique ID` | `TEXT` | Unique player identifier |
| `Match ID` | `TEXT` | Match identifier from source data |
| `Season` | `TEXT` | Season label |
| `Split` | `TEXT` | Split label |
| `Event` | `TEXT` | Event name |
| `Day` | `INTEGER` | Event day number |
| `Stage` | `TEXT` | Stage name |
| `Round` | `TEXT` | Round label |
| `Best of ` | `INTEGER` | Series length |
| `Game Number` | `INTEGER` | Game number within series |
| `Team` | `TEXT` | Team name (uppercased) |
| `Victory` | `BOOLEAN` | Whether the player's team won |
| `Forfeit` | `BOOLEAN` | Whether the game was a forfeit |
| `OT` | `BOOLEAN` | Whether the game went to overtime |
| `Extra Time` | `DOUBLE PRECISION` | Overtime duration in seconds |
| `source_file` | `TEXT` | Source CSV filename |
| `ingested_at` | `TIMESTAMPTZ` | Ingestion timestamp |
| `row_hash` | `TEXT` | SHA-256 hash for deduplication |
| `series_id` | `TEXT` | MD5 hash grouping games into a series |

The remaining ~260 columns are performance metrics partitioned by zone (`_All Zones`, `_Defense Zone`, `_Neutral Zone`, `_Offense Zone`), covering: positioning, ball touches, speed, boost, goals, assists, saves, demos, pads collected, and more.

### `players` Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | `BIGSERIAL` | Primary key |
| `Player ID` | `TEXT` | Platform player ID |
| `Primary Handle` | `TEXT` | Primary in-game handle |
| `All Aliases` | `TEXT` | Other known handles |
| `Real Name` | `TEXT` | Real name |
| `Pronounciation` | `TEXT` | Name pronunciation |
| `Date of Birth` | `TIMESTAMPTZ` | Date of birth |
| `Country` | `TEXT` | Country |
| `Twitch` | `TEXT` | Twitch handle/URL |
| `TikTok` | `TEXT` | TikTok handle/URL |
| `Photo URL` | `TEXT` | Headshot URL |
| `source_file` | `TEXT` | Source CSV filename |
| `ingested_at` | `TIMESTAMPTZ` | Ingestion timestamp |
| `row_hash` | `TEXT` | SHA-256 hash for deduplication |

### `file_ingest` Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | `BIGSERIAL` | Primary key |
| `table_name` | `TEXT` | Target table (`stats` or `players`) |
| `file_name` | `TEXT` | Source CSV filename |
| `file_hash` | `TEXT` | SHA-256 of the file contents |
| `file_size` | `BIGINT` | File size in bytes |
| `row_count` | `INTEGER` | Total rows in the file |
| `inserted` | `INTEGER` | Rows inserted |
| `skipped` | `INTEGER` | Rows skipped (duplicate hash) |
| `errored` | `INTEGER` | Rows with coercion errors |
| `ingested_at` | `TIMESTAMPTZ` | Ingestion timestamp |

Unique index on `(table_name, file_hash)` prevents re-ingesting the same file.

## Source Files

| File | Role |
|------|------|
| `src/run.ts` | CLI entry point, orchestrates the full pipeline |
| `src/load-csv.ts` | CSV streaming, type coercion, transforms, batch inserts, series_id SQL |
| `src/datasets.ts` | Dataset configs (matches vs players) |
| `src/db.ts` | PostgreSQL connection |
| `src/stats-schema.ts` | `CREATE TABLE` and column comments for `stats` |
| `src/players-schema.ts` | `CREATE TABLE` and column comments for `players` |
| `src/schema-utils.ts` | DDL helpers for ingestion columns, row_hash, file_ingest |
| `src/util/csv.ts` | Streaming CSV parser wrapper |
| `src/util/types.ts` | Shared TypeScript types |
