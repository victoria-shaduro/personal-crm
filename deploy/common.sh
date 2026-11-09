#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
DEPLOY_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
cd "$DEPLOY_DIR"

require_env() {
  [[ -f .env ]] || { echo 'Create the server .env before deploying.' >&2; exit 1; }
  [[ $(stat -c %a .env) == 600 && -O .env ]] || {
    echo 'The server .env must belong to the deploy user and have mode 600.' >&2; exit 1;
  }
}

lock_deployment() {
  exec 9>"$DEPLOY_DIR/.deploy.lock"
  flock -w 600 9
}

compose() {
  docker compose -p prod --project-directory "$DEPLOY_DIR" \
    --env-file "$DEPLOY_DIR/.env" -f "$DEPLOY_DIR/deploy/compose.yaml" "$@"
}

validate_image() {
  [[ $IMAGE =~ ^ghcr\.io/victoria-shaduro/personal-crm:[a-f0-9]{40}$ ]] || {
    echo 'A full commit SHA image tag is required.' >&2; exit 1;
  }
  export IMAGE
}

record_release() {
  local old=''
  [[ ! -f .current-image ]] || old=$(cat .current-image)
  if [[ -n $old && $old != "$IMAGE" ]]; then
    printf '%s\n' "$old" > .previous-image.tmp
    mv .previous-image.tmp .previous-image
  fi
  printf '%s\n' "$IMAGE" > .current-image.tmp
  mv .current-image.tmp .current-image
}
