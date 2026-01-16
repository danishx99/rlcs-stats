# RLCS Stats Loader

Load multiple CSVs into a single Postgres table using Bun + TypeScript. The loader is streaming, idempotent, and resilient to blank lines and bad cells.

## What it does

- Creates/updates the `stats` table using `createStatsTableSql`.
- Adds ingestion metadata: `source_file`, `ingested_at`.
- Adds `row_hash` and a unique index for idempotency.
- Streams CSV rows and coerces types safely.
- Skips duplicates on re-run.
- Writes an import report to `./out/import-report.json`.

## Requirements

- Bun
- Docker + Docker Compose

## Setup

1) Copy env file and adjust if needed:

```bash
cp .env.example .env
```

2) Start Postgres:

```bash
docker compose up -d
```

3) Install dependencies:

```bash
bun install
```

## Run

```bash
bun run src/run.ts --dir ./data
```

## CLI Flags

- `--dir ./data` (default `./data`)
- `--pattern "*.csv"` (default `*.csv`)
- `--limit N` (optional, stop after N rows per file)
- `--dry-run` (parse + validate only, no DB writes)
- `--strict` (stop on first row error)
- `--truncate` (TRUNCATE stats before loading)
- `--allow-new-columns` (temporarily add new CSV columns as TEXT)

## Schema + Columns

The loader uses the schema in `src/stats-schema.ts`. Column names in SQL are quoted to match CSV headers exactly (including spaces and punctuation).

Additional columns created at runtime:

- `source_file TEXT NOT NULL DEFAULT ''`
- `ingested_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- `row_hash TEXT NOT NULL` with a unique index

### Schema evolution (new CSV columns)

By default, the loader **fails** if a CSV contains columns not defined in `src/stats-schema.ts`. If you want to ingest and add them temporarily, run with `--allow-new-columns`. **Those columns are created as `TEXT` only as a placeholder.** After the run:

1) Update `src/stats-schema.ts` with the correct type for each new column.
2) If needed, backfill/convert data types with a manual SQL migration.
3) Re-run the loader if you want the new types to be reflected on fresh loads.

## Type Coercion Rules

Blank strings are treated as `NULL`.

- TEXT: stored as-is
- INTEGER: `parseInt`, invalid => `NULL`
- DOUBLE PRECISION: `parseFloat`, invalid => `NULL`
- BOOLEAN: accepts `true/false`, `t/f`, `1/0`, `yes/no` (case-insensitive); invalid => `NULL`
- TIMESTAMPTZ: `new Date(value)`; if no timezone, it is treated as UTC

When a cell is invalid, the row is still inserted with `NULL` for that cell, and the error is logged. Use `--strict` to stop on first error.

## Idempotency

`row_hash` is a SHA-256 of the canonicalized row (excluding id and ingested_at). Inserts use:

```
ON CONFLICT (row_hash) DO NOTHING
```

Re-running the loader does not create duplicates.

## Reporting

An import report is written to:

```
./out/import-report.json
```

It includes per-file counts and up to the first 100 row errors.

## Example

```bash
bun run src/run.ts --dir ./data --pattern "*.csv" --dry-run
```

## 🧠 More Powerful: pgAdmin 4 (feature-rich)

Why
- Full Postgres management UI
- Query planner, indexes, stats, roles
- Best long-term tool

Tradeoff
- Heavier
- Slightly more setup

Add to docker-compose.yml
- Already included in this repo

Access
- Browser: http://localhost:5050
- Login with pgAdmin credentials (default: admin@example.com / admin)

Quick start
```bash
docker compose up -d pgadmin
```

Register server:
- Host: postgres
- Port: 5432
- Username/password: Postgres creds

Best if you want to:
- Analyze query performance
- Create indexes later
- Explore large datasets deeply
