#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/home/urloft"
TARGET="${1:-all}"
BRANCH="${2:-prod}"

cd "$APP_DIR"

git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH"

reload_pm2_app() {
  local app_name="$1"
  if pm2 describe "$app_name" >/dev/null 2>&1; then
    pm2 reload "$app_name" --update-env
  else
    pm2 start "$APP_DIR/server/ecosystem.config.cjs" --only "$app_name" --update-env
  fi
}

deploy_backend() {
  bun install --cwd backend --frozen-lockfile
  reload_pm2_app "urloft-backend"
}

  deploy_frontend() {
  bun install --cwd frontend-bun-ejs --frozen-lockfile
  bun run --cwd frontend-bun-ejs build
  reload_pm2_app "urloft-frontend"
}

case "$TARGET" in
  backend)
    deploy_backend
    ;;
  frontend)
    deploy_frontend
    ;;
  all)
    deploy_backend
    deploy_frontend
    ;;
  *)
    echo "Unknown deploy target: $TARGET"
    echo "Valid targets: backend | frontend | all"
    exit 1
    ;;
esac

pm2 save

echo "Deploy completed successfully (target=$TARGET, branch=$BRANCH)"
