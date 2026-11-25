#!/usr/bin/env bash
set -Eeuo pipefail

export NEXT_TELEMETRY_DISABLED=1
export DATABASE_URL="postgresql://crm_ci@127.0.0.1:${PR_CHECK_POSTGRES_PORT:?PostgreSQL service required}/crm_ci"
export OWNER_EMAIL=owner@example.org SMTP_HOST=127.0.0.1 BETTER_AUTH_URL=http://127.0.0.1:3000
BETTER_AUTH_SECRET=$(openssl rand -hex 32)
export BETTER_AUTH_SECRET
export GROUPS_TEST_DATABASE_URL="$DATABASE_URL"

echo '::group::Formatting, lint and types'
git diff --check HEAD^1 HEAD
npm install --global "$(node -p 'require("./package.json").packageManager')"
pnpm install --frozen-lockfile
pnpm exec next typegen
pnpm lint
pnpm typecheck
echo '::endgroup::'

echo '::group::Unit and PostgreSQL integration tests'
pnpm test
echo '::endgroup::'

echo '::group::Build the application image'
docker build --tag personal-crm-pr-check .
echo '::endgroup::'

echo '::group::Browser test against the built image'
pnpm exec playwright install --with-deps chromium
pnpm db:migrate
app_container=$(docker run --detach --network host --env DATABASE_URL --env SMTP_HOST --env SMTP_PORT --env BETTER_AUTH_URL --env BETTER_AUTH_SECRET personal-crm-pr-check)
cleanup() {
  if (( $? != 0 )); then
    docker logs "$app_container" || true
  fi
  docker rm --force "$app_container" >/dev/null || true
}
trap cleanup EXIT
curl --fail --silent --show-error --retry 30 --retry-all-errors --retry-delay 1 \
  --max-time 2 http://127.0.0.1:3000/health >/dev/null
pnpm exec playwright test
echo '::endgroup::'
