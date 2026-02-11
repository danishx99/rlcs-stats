#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 2 ]; then
  echo "Usage: $0 <ssh-target> <remote-repo-dir> [branch]"
  echo "Example: $0 ubuntu@server /srv/rlcs-stats main"
  exit 1
fi

SSH_TARGET="$1"
REMOTE_DIR="$2"
BRANCH="${3:-main}"

ssh "$SSH_TARGET" "bash -lc '
  set -euo pipefail
  cd "$REMOTE_DIR"
  git fetch origin
  git checkout "$BRANCH"
  git pull --ff-only origin "$BRANCH"
  docker compose -f docker-compose.prod.yml --env-file env/.env.api up -d --build
  docker compose -f docker-compose.prod.yml --env-file env/.env.api ps
'"
