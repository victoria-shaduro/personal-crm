#!/usr/bin/env bash
set -Eeuo pipefail
source "$(dirname -- "$0")/common.sh"
IMAGE=${1:?Image is required}
select_environment "${3:-prod}"
PUBLIC_HEALTH_URL=${2:-$DEFAULT_PUBLIC_HEALTH_URL}
validate_image
lock_deployment
trap 'echo "Deployment failed; no automatic rollback was performed." >&2' ERR

if [[ -n ${4:-} ]]; then
  tar -xzf "$4" -C "$DEPLOY_DIR"
fi
require_env
require_no_pending_restore
compose config --quiet
if [[ ${CRM_USE_LOCAL_IMAGE:-0} != 1 ]]; then
  compose pull app db
fi
if [[ $PROJECT == prod ]]; then
  source deploy/backup.sh
  current_container=$(installed_app_container)
  if [[ -n $current_container ]]; then
    # Inspect the installed schema before changing either service.
    compose start --wait --wait-timeout 120 db
    login_schema=$(database_has_login)
    if [[ $login_schema == 0 ]]; then
      echo 'Stopping the previous application before the login transition backup.'
      compose stop app
    fi
  fi
  backup_before_deploy
fi
compose up -d --wait --wait-timeout 120 db
if [[ $PROJECT == staging && $(database_query "SELECT to_regclass('public.contacts') IS NOT NULL;") != t ]]; then
  echo 'Initialize the staging database with deploy/restore-staging.sh before deploying.' >&2
  exit 1
fi
echo 'Applying migrations before starting the new application image.'
compose run --rm --no-deps --pull never migrate
compose up -d --no-deps --pull never --wait --wait-timeout 120 app
bash deploy/smoke.sh "${IMAGE##*:}" "$PUBLIC_HEALTH_URL" "$PROJECT"
record_release
if [[ $PROJECT == prod ]]; then
  bash deploy/cleanup.sh
  prune_backups
fi
compose ps
echo "Deployment succeeded: $IMAGE"
