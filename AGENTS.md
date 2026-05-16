# Repository Guidelines

## Project Overview

RLCS Stats is a full-stack statistics platform for Rocket League Championship Series (RLCS) data. It ingests CSV match/player data into PostgreSQL and provides a React-based web UI for searching, analyzing, and comparing player/team statistics.

### Architecture Overview

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────────┐
│   CSV Files     │────▶│   Loader     │────▶│   PostgreSQL    │
│ (data/matches/) │     │  (src/*.ts)  │     │   (Docker)      │
└─────────────────┘     └──────────────┘     └─────────────────┘
                                                      │
                                                      ▼
┌─────────────────┐     ┌──────────────┐     ┌─────────────────┐
│   React SPA     │◀────│  REST API    │◀────│   SQL Queries   │
│ (web/src/*.tsx) │     │(server/*.ts) │     │ (server/sql/)   │
└─────────────────┘     └──────────────┘     └─────────────────┘
```

**Three main layers:**
1. **Data Loader** (`src/`) - TypeScript/Bun CLI tool for CSV ingestion
2. **REST API** (`server/`) - Node.js HTTP server providing JSON endpoints
3. **Web Frontend** (`web/`) - React + Vite SPA with dashboards and comparisons

---

## Project Structure

### Root Level
- `src/` - TypeScript loader code (CSV parsing, DB access, schema helpers)
- `server/` - REST API server source code
- `web/` - React frontend application
- `data/` - Sample CSV/XLSX input files
  - `data/matches/` - Match statistics CSVs
  - `data/players/` - Player metadata CSVs
- `out/` - Generated import reports (`out/import-report.json`)
- `sql/` - General SQL queries for insights and data validation
- `plans/` - MVP planning documents
- `docker-compose.yml` - Postgres + pgAdmin services

### Backend (`src/`)
- `run.ts` - Main entry point with CLI argument parsing
- `load-csv.ts` - Core CSV loading, streaming parser, type coercion
- `stats-schema.ts` - Match stats table schema (~280 columns)
- `players-schema.ts` - Player metadata table schema
- `datasets.ts` - Dataset configuration (matches vs players)
- `db.ts` - PostgreSQL connection setup
- `schema-utils.ts` - Schema validation utilities
- `util/` - Utility functions (csv helpers, types)

### API Server (`server/`)
- `index.ts` - HTTP server entry point, route dispatch
- `src/routes/` - API route handlers
  - `players.ts` - Player search, profiles, career stats
  - `rosters.ts` - Team/roster profiles
  - `compare.ts` - Head-to-head comparison
  - `stats.ts` - Leaderboards and featured players
  - `meta.ts` - Metadata (seasons, splits, events, stat options)
  - `image.ts` - Image proxy: resize + WebP encode + disk cache. See `docs/image-proxy.md`
- `sql/` - SQL query templates organized by route
  - `players/`, `rosters/`, `compare/`, `stats/`, `meta/`

### Web Frontend (`web/`)
- `src/App.tsx` - Main app with routing and search state
- `src/pages/` - Page-level components
  - `HomePage.tsx` - Dashboard with compare, featured, teams panels
  - `PlayerPage.tsx` - Player profile with stats
  - `RosterPage.tsx` - Team roster page
  - `StatPage.tsx` - Single stat leaderboard
- `src/components/` - Reusable UI components
  - `TopNav.tsx` - Global search bar + filters
  - `ComparePanel.tsx` - Side-by-side comparison view
  - `FeaturedPanel.tsx` - Featured players display
  - `SearchPanel.tsx` - Search results and selection
- `src/hooks/` - Custom React hooks (useSearch, useMeta, usePagination)
- `src/api/` - API client utilities
- `src/types/` - TypeScript type definitions

---

## Build, Test, and Development Commands

### Setup
```bash
bun install              # Install dependencies
```

### Data Loader
```bash
bun run src/run.ts --dir ./data    # Run loader against local CSVs
bun run load                       # Same as above via npm script
bun run src/run.ts --dir ./data --dry-run   # Dry run validation
```

### Infrastructure
```bash
docker compose up -d     # Start Postgres + pgAdmin containers
bun run db:reset         # Wipe Postgres volume and restart containers
psql postgres://stats:stats_pw@localhost:5432/statsdb  # Query the local DB
```

### API Server
```bash
bun run server           # Start REST API server
```

### Web Frontend
```bash
cd web && bun install    # Install web dependencies
cd web && bun run dev    # Start Vite dev server
```

### Testing
- No test framework configured yet. If you add tests, document the runner and add a `bun run test` script.
- For now, validate loader changes with: `bun run src/run.ts --dir ./data --dry-run`

---

## Coding Style & Naming Conventions

- **Language:** TypeScript (ESM). Use 2‑space indentation and double quotes.
- **Functions:** Prefer small, focused functions with explicit types for public APIs.
- **File naming:** kebab-case (`load-csv.ts`, `stats-schema.ts`).
- **SQL:** Keep in template strings and avoid inline string concatenation.
- **Imports:** Use explicit `.js` extensions for ESM imports.
- **Types:** Define interfaces in dedicated types files or inline for local use.

---

## Schema Evolution

- By default, the loader fails if a CSV contains columns not defined in `src/stats-schema.ts`.
- Use `--allow-new-columns` to temporarily add new columns as `TEXT`, then update `src/stats-schema.ts` and apply a proper SQL migration.

---

## Database Schema

### Tables

**`stats`** - Per-player, per-game statistics (~280 columns). Each row represents one player's performance in a single game. A 3v3 game produces 6 rows (one per player), all sharing the same `Match ID` and `Game Number`. A best-of-5 series (one `Match ID`) can have up to 30 rows.
- Key columns: `Match ID`, `Game Number`, `Unique ID` (player), `Team`, `Victory`
- `series_id`: Materialized semantic series identifier — `md5(Season|Split|Regional|Day|Stage|Round|Best of|team_a|team_b)`. Computed after ingestion by `computeSeriesIds()`. NULL for single-team or collided matches. See `docs/series-grouping.md`.
- Player performance metrics partitioned by zone (All/Defense/Neutral/Offense)
- Covers: positioning, ball touches, speed, boost, goals, assists, saves, demos
- Metadata: `source_file`, `ingested_at`, `row_hash` (for deduplication)

**`players`** - Player metadata
- Player ID, Primary Handle, Aliases, Real Name, Country, DOB, Photo URL, Social links

**`file_ingest`** - Idempotency tracking
- Tracks processed files with SHA-256 hashes to avoid re-processing

---

## API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /api/health` | Health check |
| `GET /api/meta` | Available seasons, splits, events, stat options |
| `GET /api/search?q={query}` | Search players, rosters, stats |
| `GET /api/players` | List players with filtering |
| `GET /api/players/{id}` | Player profile with career stats |
| `GET /api/players/{id}/season` | Player season-by-season breakdown |
| `GET /api/rosters/{id}` | Roster/team profile |
| `GET /api/rosters/{id}/season` | Team season breakdown |
| `GET /api/compare` | Compare multiple players/rosters |
| `GET /api/compare/history` | Head-to-head match history |
| `GET /api/stats/top` | Top-10 leaderboard for any stat |
| `GET /api/featured` | Featured player categories |
| `GET /api/image` | Image proxy with resize, WebP encode, and 30-day disk cache (see `docs/image-proxy.md`) |

---

## Commit & Pull Request Guidelines

- Git history only shows a single `Init` commit, so no convention is established yet.
- Use clear, imperative commit subjects (e.g., `Add row hash index guard`).
- PRs should include: what changed, how to run it, and any data/schema impact.

---

## Notes & Learnings

- Use `.notes/` as a scratchpad for learnings, data quirks, design decisions, and anything worth remembering across sessions.
- Read existing notes before starting work to avoid re-discovering known issues.
- Write new notes when you encounter data issues, resolve bugs, or make non-obvious decisions.

---

## Configuration & Security Notes

- Copy `.env.example` to `.env` and keep credentials local.
- The loader writes reports to `out/` and expects Postgres to be reachable via the env config.
- Never commit secrets or database credentials to the repository.
