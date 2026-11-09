#!/usr/bin/env bash
set -Eeuo pipefail
source "$(dirname -- "$0")/common.sh"
require_env
lock_deployment
[[ ! -f .seed-complete ]] || { echo 'Seed already completed; skipping.'; exit 0; }
IMAGE=$(cat .current-image)
validate_image
running=$(compose ps -q app)
[[ -n $running && $(docker inspect --format '{{.Config.Image}}' "$running") == "$IMAGE" ]] || {
  echo 'Seed requires the last successfully deployed application to be running.' >&2; exit 1;
}
compose run --rm --no-deps --pull never seed
date -u +%FT%TZ > .seed-complete
echo 'One-time seed completed. Future deployments will not run it.'
