# Deployment

## Architecture

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  rlesport.gg     │────▶│  Railway         │────▶│  Railway         │
│  VPS / Apache    │     │  API Service     │     │  PostgreSQL      │
│  Static frontend │     │  Bun + HTTP      │     │  Managed DB      │
└──────────────────┘     └──────────────────┘     └──────────────────┘
```

| Layer | Host | URL |
|-------|------|-----|
| Frontend | VPS (Apache, `~/public_html/`) | `https://rlesport.gg` |
| API | Railway | `https://api-production-bfd2.up.railway.app` |
| Database | Railway PostgreSQL | Internal: `postgres.railway.internal:5432` |

---

## Prerequisites

- [Railway CLI](https://docs.railway.com/reference/cli-api#install) installed and authenticated (`railway login`)
- SSH access to VPS configured as `ssh rlcs` (see `~/.ssh/config`)
- Bun installed locally for builds

---

## Deploy API

The API service runs on Railway using `Dockerfile.api`.

```bash
# Manual deploy (optional)
railway up
```

In normal operation, Railway auto-deploys the API on new commits.

Railway auto-detects `Dockerfile.api` via the `RAILWAY_DOCKERFILE_PATH` variable. The service reads `PORT` (set by Railway) and `DATABASE_URL` (linked to the Postgres service).

To check status:

```bash
railway status
railway logs
```

To verify:

```bash
curl https://api-production-bfd2.up.railway.app/api/health
```

### Environment variables (API service)

| Variable | Source | Notes |
|----------|--------|-------|
| `PORT` | Railway (auto) | Railway assigns a port dynamically |
| `DATABASE_URL` | Railway reference: `${{Postgres.DATABASE_URL}}` | Internal connection string |
| `RAILWAY_DOCKERFILE_PATH` | Set manually: `Dockerfile.api` | Tells Railway which Dockerfile to use |

---

## Deploy Frontend

The frontend is a static Vite build served by Apache on the VPS. SPA routing is handled by `.htaccess`.

### Quick deploy

```bash
./scripts/deploy-frontend.sh
```

### Manual steps

1. Build with the production API URL baked in:

   ```bash
   VITE_API_URL=https://api-production-bfd2.up.railway.app bun run build:web
   ```

2. Upload to VPS:

   ```bash
   scp -r web/dist/* web/dist/.htaccess rlcs:~/public_html/
   ```

3. Verify:
   - `https://rlesport.gg` loads the app
   - `https://rlesport.gg/player/123` works (SPA fallback, not 404)

### SPA routing

Apache needs `mod_rewrite` enabled. The `.htaccess` in `web/dist/` handles fallback:

```apache
RewriteEngine On
RewriteBase /
RewriteRule ^index\.html$ - [L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.html [L]
```

---

## Load / Reload Data

Data is loaded from local CSV files into the Railway Postgres instance via its public proxy URL.

```bash
bun run prod:data:sync
```

This runs `src/run.ts` with `--sync`, which reconciles prod data to match current `data/` CSVs without resetting unrelated tables (for example `feedback`):
- changed CSVs are replaced
- stale CSV-backed rows are removed
- unchanged files are skipped

---

## Typical Workflows

### Ship a code change (API + frontend)

```bash
# Push to main:
# - Railway auto-deploys API
# - GitHub Action deploys frontend
# - GitHub Action runs db sync (bun run db:load with --sync)
git push origin main
```

### Update data only (new CSV files)

```bash
bun run prod:data:sync
```

### Verify everything is healthy

```bash
curl -s https://api-production-bfd2.up.railway.app/api/health | jq .
curl -s -o /dev/null -w "%{http_code}" https://rlesport.gg/
```

---

## Local Development (Docker)

For local development with Docker, see `docker-compose.yml` (dev) and `docker-compose.prod.yml` (prod-like).

```bash
# Dev: start Postgres locally
docker compose up -d

# Dev: run API + frontend with hot reload
bun run dev
```

---

## Notes

- **CORS**: API allows all origins (`Access-Control-Allow-Origin: *`)
- **Image proxy**: Player photos are proxied through the API at `/api/image?url=<encoded>`
- **CI/CD**: on push to `main`, Railway auto-deploys API; GitHub Actions deploys frontend and runs Railway data sync
- The server reads `PORT` (Railway), falling back to `API_PORT`, then `8787`
