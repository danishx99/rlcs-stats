#!/usr/bin/env bash
set -euo pipefail

API_URL="https://api-production-bfd2.up.railway.app"

echo "==> Building frontend (API_URL=$API_URL)..."
cd "$(dirname "$0")/.."
VITE_API_URL="$API_URL" bun run build:web

# Write .htaccess for Apache SPA routing
cat > web/dist/.htaccess <<'HTACCESS'
RewriteEngine On
RewriteBase /
RewriteRule ^index\.html$ - [L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.html [L]
HTACCESS

echo "==> Uploading to VPS..."
scp -r web/dist/* web/dist/.htaccess rlcs:~/public_html/

echo "==> Done! Site deployed to https://rlesport.gg"
