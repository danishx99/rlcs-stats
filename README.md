# RLCS Stats

A full-stack statistics platform for the Rocket League Championship Series. Ingests CSV match data into Postgres, exposes a JSON API, and serves a React frontend for player profiles, team rosters, leaderboards, and head-to-head comparisons across every RLCS season.

Built end-to-end as a portfolio project — data pipeline, API, and UI.

> **Live demo:** <https://rlesport.gg/>
>
> **Screenshot:**
>
> ![Home page](reference/home%20page.jpg)

## Tech stack

- **Runtime:** Bun + TypeScript (ESM)
- **Database:** PostgreSQL 16 (Docker)
- **API:** Lightweight Node HTTP server with SQL templates
- **Web:** React 18 + Vite + React Router
- **Infra:** Docker Compose for local dev; example workflow for VPS + Railway deployment

## Architecture

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

Three layers:

1. **Loader** (`src/`) — streaming CSV ingest with type coercion, idempotency via `row_hash`, and a unique-index dedupe guard. Per-row errors are logged but don't abort the run.
2. **API** (`server/`) — REST endpoints for search, player/roster profiles, leaderboards, head-to-head compare, and an image proxy (resize + WebP + disk cache).
3. **Web** (`web/`) — React SPA with global search, filters, player/team pages, comparison panel, and per-stat leaderboards.

## Quick start

Requirements: [Bun](https://bun.sh), Docker + Docker Compose.

```bash
# 1. Install deps
bun install

# 2. Copy env
cp .env.example .env

# 3. Start Postgres
docker compose up -d

# 4. Load sample data from data/
bun run load

# 5. Run API + web together
bun run dev
```

The web app runs at <http://localhost:5173>, API at <http://localhost:8787>.

Useful scripts:

- `bun run db:reset` — wipe and restart Postgres
- `bun run load -- --dry-run` — validate CSVs without writing
- `bun run test` — unit tests (`bun run test:all` includes integration)
- `bun run build:web` — production frontend build

## Project structure

```
src/        CSV loader (run.ts, load-csv.ts, schemas)
server/     REST API (routes + SQL templates in server/sql/)
web/        React frontend (pages, components, hooks)
data/       Sample CSV inputs (matches, players, rosters, etc.)
docs/       Architecture, deployment, ADRs, page-level docs
sql/        Ad-hoc analytics and migration SQL
scripts/    Deploy and data-integrity helpers
tests/      Unit + integration tests
```

## Features

- **Search** across players, teams, and stats with fuzzy matching
- **Player profiles** with career and season-by-season stats, customizable spotlight, event history
- **Roster profiles** with team performance broken down by season
- **Leaderboards** for any stat with minimum-games filter and per-game variants
- **Head-to-head comparison** of multiple players or teams with shared match history
- **Image proxy** that resizes upstream player/team photos, encodes WebP, and caches to disk

## Documentation

- [`docs/data-pipeline.md`](docs/data-pipeline.md) — loader internals and schema evolution
- [`docs/series-grouping.md`](docs/series-grouping.md) — how series IDs are materialized
- [`docs/image-proxy.md`](docs/image-proxy.md) — image proxy design
- [`docs/rating.md`](docs/rating.md) — player rating model
- [`docs/deploy.md`](docs/deploy.md) — production deployment notes
- [`docs/adr/`](docs/adr/) — architecture decisions
- [`docs/pages/`](docs/pages/) — page-level UX/data contracts

## License

[MIT](LICENSE) © Danish Saleem
