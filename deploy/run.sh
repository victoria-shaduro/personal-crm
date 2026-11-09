#!/usr/bin/env bash
set -Eeuo pipefail
source "$(dirname -- "$0")/common.sh"
IMAGE=${1:?Image is required}
PUBLIC_HEALTH_URL=${2:?Public health URL is required}
validate_image
require_env
lock_deployment
trap 'echo "Deployment failed; no automatic rollback was performed." >&2' ERR

compose config --quiet
compose pull app db
compose up -d --wait --wait-timeout 120 db
echo 'Applying migrations before starting the new application image.'
compose run --rm --no-deps --pull never migrate
compose up -d --no-deps --wait --wait-timeout 120 app
bash deploy/smoke.sh "${IMAGE##*:}" "$PUBLIC_HEALTH_URL"
record_release
bash deploy/cleanup.sh
compose ps
echo "Deployment succeeded: $IMAGE"
