#!/usr/bin/env bash
set -euo pipefail

SYNC_DATA="${SYNC_DATA:-1}"
DEPLOY_FRONTEND="${DEPLOY_FRONTEND:-0}"

echo "Deploying API to Railway..."
railway up

if [ "${SYNC_DATA}" = "1" ]; then
  echo "Running Railway data sync..."
  ./scripts/sync-railway-data.sh
fi

if [ "${DEPLOY_FRONTEND}" = "1" ]; then
  echo "Deploying frontend..."
  ./scripts/deploy-frontend.sh
fi
