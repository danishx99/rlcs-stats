#!/usr/bin/env bash
set -euo pipefail

DATABASE_PUBLIC_URL="${DATABASE_URL:-}"

if [ -z "${DATABASE_PUBLIC_URL}" ]; then
  if ! command -v railway >/dev/null 2>&1; then
    echo "railway CLI not found. Install it and run 'railway login' or pass DATABASE_URL." >&2
    exit 1
  fi
  DATABASE_PUBLIC_URL="$(railway variables --kv -s Postgres | awk -F= '/^DATABASE_PUBLIC_URL=/{sub(/^DATABASE_PUBLIC_URL=/, ""); print; exit}')"
fi

if [ -z "${DATABASE_PUBLIC_URL}" ]; then
  echo "DATABASE_PUBLIC_URL not found. Set DATABASE_URL or ensure Railway Postgres variable is available." >&2
  exit 1
fi

echo "Syncing data to Railway Postgres using --sync..."
DATABASE_URL="${DATABASE_PUBLIC_URL}" bun run db:load
