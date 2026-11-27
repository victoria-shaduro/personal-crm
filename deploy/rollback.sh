#!/usr/bin/env bash
set -Eeuo pipefail
source "$(dirname -- "$0")/common.sh"
select_environment "${2:-prod}"
require_env
lock_deployment
require_no_pending_restore
if [[ -n ${3:-} ]]; then
  tar -xzf "$3" -C "$DEPLOY_DIR"
fi
PUBLIC_HEALTH_URL=${PUBLIC_HEALTH_URL:-$DEFAULT_PUBLIC_HEALTH_URL}
IMAGE=$(cat .current-image)
validate_image
running=$(compose ps -q app)
actual=''
[[ -z $running ]] || actual=$(docker inspect --format '{{.Config.Image}}' "$running")
if [[ -n ${1:-} ]]; then
  IMAGE=$1
elif [[ $actual == "$IMAGE" ]]; then
  [[ -f .previous-image ]] || { echo 'No previous release is recorded.' >&2; exit 1; }
  IMAGE=$(cat .previous-image)
fi
validate_image
# Roll back the application only. Database migrations are never reversed here.
docker image inspect "$IMAGE" >/dev/null
target_schema=$(image_has_login "$IMAGE")
database_schema=$(database_has_login)
if [[ $target_schema != "$database_schema" ]]; then
  echo 'The previous image is incompatible with the installed database schema.' >&2
  exit 1
fi
compose up -d --no-deps --pull never --wait --wait-timeout 120 app
bash deploy/smoke.sh "${IMAGE##*:}" "$PUBLIC_HEALTH_URL" "$PROJECT"
record_release
echo "Manual rollback completed: $IMAGE"
