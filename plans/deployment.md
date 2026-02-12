# Deployment Plan

## Architecture

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  rlesport.gg     │────▶│  Render (free)   │────▶│  Supabase (free) │
│  VPS / Apache    │     │  Backend API     │     │  PostgreSQL      │
│  Static frontend │     │  Bun + Node      │     │  500 MB          │
└──────────────────┘     └──────────────────┘     └──────────────────┘
                                 ▲
                         ┌───────┴────────┐
                         │ UptimeRobot    │
                         │ Ping /health   │
                         │ every 5 min    │
                         └────────────────┘
```

| Layer | Host | URL | Cost |
|-------|------|-----|------|
| Frontend | VPS (Apache, `public_html/`) | `https://rlesport.gg` | $0 (existing) |
| Backend | Render free web service | `https://rlcs-stats-api.onrender.com` | $0 |
| Database | Supabase free PostgreSQL | Connection string in env | $0 |
| Keep-alive | UptimeRobot | Pings `/api/health` every 5 min | $0 |

---

## Step 1: Supabase Database

1. Create a Supabase project at https://supabase.com
2. Go to **Settings → Database** and copy the **Connection string (URI)**
   - Format: `postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres`
3. Seed the database:
   ```bash
   DATABASE_URL="<supabase-connection-string>" bun run src/run.ts --dir ./data
   DATABASE_URL="<supabase-connection-string>" bun run src/run.ts --dir ./data --dataset players
   ```
4. Verify with a quick query:
   ```bash
   psql "<supabase-connection-string>" -c "SELECT COUNT(*) FROM stats;"
   ```

---

## Step 2: Render Backend

### Files to create

**`render.yaml`** (repo root):
```yaml
services:
  - type: web
    name: rlcs-stats-api
    runtime: node
    plan: free
    buildCommand: bun install
    startCommand: bun server/index.ts
    envVars:
      - key: DATABASE_URL
        sync: false
      - key: API_PORT
        value: "10000"
```

### Deploy steps

1. Push repo to GitHub (if not already)
2. Go to https://dashboard.render.com → **New → Blueprint**
3. Connect the repo, Render reads `render.yaml`
4. Set `DATABASE_URL` to the Supabase connection string
5. Deploy — backend available at `https://rlcs-stats-api.onrender.com`
6. Verify: `curl https://rlcs-stats-api.onrender.com/api/health`

### Notes
- Render free tier uses port `10000` (set via `API_PORT` env var)
- CORS is already `Access-Control-Allow-Origin: *` — no changes needed
- Render auto-deploys on push to main

---

## Step 3: UptimeRobot Keep-Alive

1. Create account at https://uptimerobot.com
2. Add HTTP monitor:
   - URL: `https://rlcs-stats-api.onrender.com/api/health`
   - Interval: **5 minutes**
   - Alert contacts: your email (optional, also gives uptime monitoring)
3. This prevents Render from spinning down the service after 15 min idle

---

## Step 4: Frontend on VPS

### Files to create

**`web/public/.htaccess`** (copied into `dist/` at build time):
```apache
RewriteEngine On
RewriteBase /

# Serve existing files/directories as-is
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d

# SPA fallback — all other routes serve index.html
RewriteRule ^ index.html [L]
```

**`web/.env.production`**:
```
VITE_API_URL=https://rlcs-stats-api.onrender.com
VITE_FEEDBACK_ENABLED=true
```

**`scripts/deploy-frontend.sh`**:
```bash
#!/usr/bin/env bash
set -euo pipefail

VPS_USER="rlespfpwtk"
VPS_HOST="196.22.142.111"
VPS_PORT="2222"
VPS_PATH="public_html"

echo "==> Building frontend..."
cd "$(dirname "$0")/.."
bun run build:web

echo "==> Uploading to VPS..."
scp -P "$VPS_PORT" -r web/dist/* "$VPS_USER@$VPS_HOST:$VPS_PATH/"

echo "==> Done! Site deployed to https://rlesport.gg"
```

### Deploy steps

1. Build: `bun run build:web` (picks up `web/.env.production` automatically)
2. Upload: `scp -P 2222 -r web/dist/* rlespfpwtk@196.22.142.111:public_html/`
3. Verify: visit `https://rlesport.gg` and `https://rlesport.gg/stats/goals`
   - The SPA route should work (not 404) thanks to `.htaccess`

Or just run: `./scripts/deploy-frontend.sh`

---

## Verification Checklist

- [ ] Supabase DB seeded, `SELECT COUNT(*) FROM stats` returns rows
- [ ] Render backend responds at `/api/health`
- [ ] UptimeRobot monitor is active and green
- [ ] `https://rlesport.gg` loads the app
- [ ] `https://rlesport.gg/stats/goals` works (SPA fallback)
- [ ] API calls from frontend reach Render backend (check Network tab)
- [ ] Player photos load (image proxy goes through Render)

---

## Redeployment

- **Backend**: push to main → Render auto-deploys
- **Frontend**: run `./scripts/deploy-frontend.sh` (or build + SCP manually)
- **Database**: re-run loader against Supabase URL if data changes
