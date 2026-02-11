# Production Deploy (Docker)

This setup runs the app with separate containers:
- `api` (Bun + Node HTTP API)
- `web` (Nginx serving built React app)
- optional `postgres` (`localdb` profile)

## 1) Prepare env files

```bash
cp env/.env.api.example env/.env.api
```

Edit `env/.env.api`:
- `DATABASE_URL` (required, Postgres)
- `API_PORT` (optional, default 8787)
- `VITE_API_URL` (optional, default `/api`)

If hosting API behind web container proxy, keep `VITE_API_URL=/api`.

## 2) Build and run

```bash
VITE_API_URL=/api docker compose -f docker-compose.prod.yml --env-file env/.env.api up -d --build
```

Shortcut:

```bash
bun run prod:up
```

App endpoints:
- frontend: `http://<host>:8080`
- API health: `http://<host>:8787/api/health`

## 3) Optional local Postgres container

If you want DB in compose (instead of managed external DB):

```bash
docker compose -f docker-compose.prod.yml --env-file env/.env.api --profile localdb up -d postgres
```

Then set `DATABASE_URL=postgres://stats:stats_pw@postgres:5432/statsdb` in `env/.env.api`.

## 4) Initial data load

Run once after DB is ready:

```bash
docker compose -f docker-compose.prod.yml --env-file env/.env.api run --rm api bun run src/run.ts --dir ./data
```

Shortcut:

```bash
bun run prod:load
```

## 5) Deploy via SSH (Git-based)

```bash
scripts/deploy.sh <user@host> <remote-repo-dir> [branch]
```

This script fetches latest code and runs compose build/restart on the server.
