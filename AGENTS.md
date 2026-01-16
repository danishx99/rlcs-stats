# Repository Guidelines

## Project Structure & Module Organization
- `src/`: TypeScript loader code (CSV parsing, DB access, schema helpers).
- `data/`: sample CSV/XLSX inputs.
- `out/`: generated import reports (`out/import-report.json`).
- `docker-compose.yml`: Postgres + pgAdmin services.

## Build, Test, and Development Commands
- `bun install`: install dependencies.
- `bun run src/run.ts --dir ./data`: run the loader against local CSVs.
- `bun run load`: same as above via the script.
- `docker compose up -d`: start Postgres (and pgAdmin) containers.

## Coding Style & Naming Conventions
- Language: TypeScript (ESM). Use 2‑space indentation and double quotes (match existing files).
- Prefer small, focused functions with explicit types for public APIs.
- File naming is kebab‑case (`load-csv.ts`, `stats-schema.ts`).
- Keep SQL in template strings and avoid inline string concatenation where possible.

## Schema Evolution
- New CSV columns are accepted and added to `stats` so loads can continue.
- **Follow-up required:** update `src/stats-schema.ts` with the correct column types, and apply any SQL migration needed to convert existing placeholder `TEXT` columns.

## Testing Guidelines
- No test framework is configured yet. If you add tests, document the runner and add a `bun run test` script.
- For now, validate changes with a dry run: `bun run src/run.ts --dir ./data --dry-run`.

## Commit & Pull Request Guidelines
- Git history only shows a single `Init` commit, so no convention is established yet.
- Use clear, imperative commit subjects (e.g., `Add row hash index guard`).
- PRs should include: what changed, how to run it, and any data/schema impact.

## Configuration & Security Notes
- Copy `.env.example` to `.env` and keep credentials local.
- The loader writes reports to `out/` and expects Postgres to be reachable via the env config.
