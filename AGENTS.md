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
2. **REST API** (`server/`) - Hono app (on Bun via `@hono/node-server`) providing JSON endpoints
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
- `sql/` - General SQL queries for migrations and data validation
- `scripts/` - Deploy and data-integrity helpers
- `tests/` - Unit (`tests/unit`) and integration (`tests/integration`) tests
- `docker-compose.yml` - Postgres + Adminer services (dev)
- `docker-compose.prod.yml` - Prod-like compose with image-cache volume

### Backend (`src/`)
- `run.ts` - Main entry point; CLI parsing + `ensureSchema` + ingest loop
- `load-csv.ts` - Streaming CSV parse, type coercion, batch insert, `computeSeriesIds`
- `stats-schema.ts` - `stats` table schema (~284 columns)
- `players-schema.ts` - Player metadata schema
- `teams-schema.ts` / `standings-schema.ts` / `brackets-schema.ts` - Other dataset schemas
- `load-standings.ts` / `load-brackets.ts` - Dataset-specific loaders
- `datasets.ts` - Dataset configuration (matches, players, teams, standings, brackets)
- `db.ts` - PostgreSQL connection setup
- `schema-utils.ts` - DDL helpers (ingestion columns, row_hash, file_ingest)
- `util/csv.ts` - Streaming CSV parser wrapper
- `util/sql.ts` - `quoteIdent` helper (shared by loader)
- `util/types.ts` - Shared loader types (`ColumnSpec`, `ColumnType`, `CellValue`, `FileReport`, `RowError`)

### API Server (`server/`)
- `index.ts` - Hono app entry point: middleware (CORS, body limit), route registration, `serve()`
- `src/config.ts` / `db.ts` / `types.ts` / `spotlight.ts` - Shared server modules
- `src/routes/` - API route handlers
  - `players.ts` - Player search, profiles, season + results
  - `rosters.ts` - Team/roster profiles (batched roster lookups, no N+1)
  - `compare.ts` - Head-to-head comparison and history
  - `stats.ts` - Leaderboards (`/api/stats/top`)
  - `featured.ts` - Featured player categories (`/api/featured`)
  - `meta.ts` - Metadata (seasons, splits, events, stat options/columns)
  - `search.ts` - Cross-entity search (`/api/search`)
  - `events.ts` - Event detail, placements, bracket, leaderboards
  - `series.ts` - Series detail and listings
  - `standings.ts` - Season standings
  - `insights.ts` - Homepage "Fast Insights" queries (inline SQL, in-memory cache)
  - `feedback.ts` - Feedback submission
  - `image.ts` - Image proxy: resize + WebP + disk cache. See `docs/image-proxy.md`
- `src/utils/` - Cross-route helpers: `filters.ts`, `responses.ts` (`jsonCached`, `errorJson`), `phases.ts`, `roster.ts`, `sql.ts` (`columnRef`), `stats.ts` (`metricExpression`, `ratingExpression`)
- `sql/` - SQL query templates organized by route
  - `players/`, `rosters/`, `compare/`, `stats/`, `meta/`, `events/`, `series/`, `standings/`, `search/`, `featured/`

### Web Frontend (`web/`)
- `src/App.tsx` - Routing only (no global search state — each page owns its own)
- `src/main.tsx` - React entry point
- `src/pages/` - Page-level components
  - `HomePage.tsx` - Dashboard (search, standings, insights, featured)
  - `PlayerPage.tsx` - Player profile (orchestrates `PlayerResultsPanel`, `PlayerSeasonPanel`)
  - `RosterPage.tsx` - Team/roster profile
  - `EventPage.tsx` - Event detail (orchestrates `EventBracketPanel`, `EventLeaderboardsPanel`, `EventSearchWidget`)
  - `StatPage.tsx` - Multi-stat leaderboard grid (see ADR 0001)
  - `ComparePage.tsx` - Head-to-head compare
  - `SeriesPage.tsx` - Series detail
  - `FeedbackPage.tsx` - Feedback log
- `src/components/` - Reusable UI components (`ComparePanel`, `FeaturedPanel`, `Leaderboard`, `StatPicker`, `SeasonTable`, etc.)
  - `player/` - Player page sub-panels (`PlayerResultsPanel`, `PlayerSeasonPanel`)
  - `event/` - Event page sub-panels (`EventBracketPanel`, `EventLeaderboardsPanel`, `EventSearchWidget`)
  - `ui/` - Generic primitives (`PanelState`, `SkeletonBlock`, `SkeletonRows`)
- `src/hooks/` - `useAsyncResource`, `useMeta`, `useShare`, `useStatLeaderboards`, `useStatSelection`, `useTeamLogos`
- `src/api/index.ts` - Single `request<T>()` client with per-endpoint typed param interfaces (`api.search()`, `api.statsTop()`, etc.)
- `src/utils/` - Formatting and routing helpers (`format.ts` exports `ordinal`, `placementLabel`, `formatPlacement`; `normalize.ts` exports `proxyImageUrl` which delegates to `resolveApiPath`; `compare.ts`, `event-routing.ts`, `team-routing.ts`, etc.)
- `src/types/` - TypeScript type definitions
- `src/styles.css` - Single global stylesheet

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
docker compose up -d     # Start Postgres + Adminer containers
bun run db:reset         # Wipe Postgres volume and restart containers
psql postgres://stats:stats_pw@localhost:5432/statsdb  # Query the local DB
```

### API Server + Web (combined)
```bash
bun run dev              # Concurrently runs API (nodemon + Bun) and Vite dev server
bun run dev:api          # API only
bun run dev:web          # Frontend only
```

### Testing
```bash
bun run test             # Unit tests (tests/unit)
bun run test:integration # Integration tests (spins up test DB)
bun run test:all         # Both
bun run verify:data      # Run scripts/verify-data-integrity.ts against current DB
```

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
- `series_id`: Materialized semantic series identifier — `md5(Season|Split|Event|Day|Stage|Round|Best of|team_a|team_b)`. Computed after ingestion by `computeSeriesIds()`. NULL for single-team or collided matches. See `docs/series-grouping.md`.
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
| `GET /api/stats/top` | Leaderboard for any stat (`limit`, `minGames`, filters) |
| `GET /api/featured` | Featured player categories |
| `GET /api/insights` | Homepage "Fast Insights" categories (in-memory cached) |
| `GET /api/standings` | Season standings |
| `GET /api/events/{id}` | Event detail, placements, bracket, leaderboards |
| `GET /api/series`, `GET /api/series/{id}`, `GET /api/series/meta` | Series listing + detail |
| `GET /api/feedback` (and `POST`) | Feedback log |
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
