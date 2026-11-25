#!/usr/bin/env bash
set -Eeuo pipefail
source "$(dirname -- "$0")/common.sh"
require_env
lock_deployment
require_no_pending_restore
PUBLIC_HEALTH_URL=${PUBLIC_HEALTH_URL:-$DEFAULT_PUBLIC_HEALTH_URL}
IMAGE=$(cat .current-image)
export IMAGE
running=$(compose ps -q app)
actual=''
[[ -z $running ]] || actual=$(docker inspect --format '{{.Config.Image}}' "$running")
if [[ $actual == "$IMAGE" ]]; then
  IMAGE=$(cat .previous-image)
fi
IMAGE=${1:-$IMAGE}
validate_image
# Roll back the application only. Database migrations are never reversed here.
docker image inspect "$IMAGE" >/dev/null
target_schema=$(image_has_login "$IMAGE")
database_schema=$(database_has_login)
if [[ $target_schema != "$database_schema" ]]; then
  echo 'This image requires a matching database backup. Use restore.sh --with-image <backup-file>.' >&2
  exit 1
fi
compose up -d --no-deps --pull never --wait --wait-timeout 120 app
bash deploy/smoke.sh "${IMAGE##*:}" "$PUBLIC_HEALTH_URL"
record_release
echo "Manual rollback completed: $IMAGE"
