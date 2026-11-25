#!/usr/bin/env bash
set -Eeuo pipefail
source "$(dirname -- "$0")/common.sh"
source deploy/backup.sh
IMAGE=${1:?Image is required}
PUBLIC_HEALTH_URL=${2:?Public health URL is required}
validate_image
require_env
lock_deployment
trap 'echo "Deployment failed; no automatic rollback was performed." >&2' ERR

require_no_pending_restore
compose config --quiet
compose pull app db
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
compose up -d --wait --wait-timeout 120 db
echo 'Applying migrations before starting the new application image.'
compose run --rm --no-deps --pull never migrate
compose up -d --no-deps --wait --wait-timeout 120 app
bash deploy/smoke.sh "${IMAGE##*:}" "$PUBLIC_HEALTH_URL"
record_release
bash deploy/cleanup.sh
compose ps
prune_backups
echo "Deployment succeeded: $IMAGE"
