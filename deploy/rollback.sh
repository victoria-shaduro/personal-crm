#!/usr/bin/env bash
set -Eeuo pipefail
source "$(dirname -- "$0")/common.sh"
require_env
lock_deployment
PUBLIC_HEALTH_URL=${PUBLIC_HEALTH_URL:-https://app.xn----7sbgnddegvj7a8c6i.xn--p1ai/health}
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
compose up -d --no-deps --pull never --wait --wait-timeout 120 app
bash deploy/smoke.sh "${IMAGE##*:}" "$PUBLIC_HEALTH_URL"
record_release
echo "Manual rollback completed: $IMAGE"
