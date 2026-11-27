#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
DEPLOY_DIR=$(cd -- "${CRM_DEPLOY_DIR:-$(dirname -- "${BASH_SOURCE[0]}")/..}" && pwd -P)
BACKUP_DIR="$(dirname -- "$DEPLOY_DIR")/personal-crm-backups"
RESTORE_STATE="$DEPLOY_DIR/.restore-in-progress"
DEFAULT_PUBLIC_HEALTH_URL=https://app.xn----7sbgnddegvj7a8c6i.xn--p1ai/health
STAGING_ORIGIN=https://test-app.xn----7sbgnddegvj7a8c6i.xn--p1ai
cd "$DEPLOY_DIR"

select_environment() {
  PROJECT=$1
  if [[ $PROJECT == staging && $DEPLOY_DIR != *-staging ]] || [[ $PROJECT == prod && $DEPLOY_DIR == *-staging ]]; then
    echo "Deployment directory does not match the $PROJECT environment." >&2
    return 1
  fi
  case "$PROJECT" in
    prod) ;;
    staging)
      DEFAULT_PUBLIC_HEALTH_URL="$STAGING_ORIGIN/health"
      export APP_HOST_PORT=3001 APP_MEMORY_LIMIT=384m DB_MEMORY_LIMIT=256m
      export BETTER_AUTH_URL="$STAGING_ORIGIN"
      ;;
    *) echo "Unknown deployment environment: $PROJECT" >&2; return 1 ;;
  esac
}

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

require_no_pending_restore() {
  [[ ! -f $RESTORE_STATE ]] || {
    echo 'A database restore is unfinished. Run deploy/restore.sh to complete it first.' >&2
    exit 1
  }
}

compose() {
  local project=${PROJECT:-prod}
  if [[ $project == prod && $DEPLOY_DIR == *-staging ]]; then
    echo 'Select the staging environment in the staging directory.' >&2
    return 1
  fi
  docker compose -p "$project" --project-directory "$DEPLOY_DIR" \
    --env-file "$DEPLOY_DIR/.env" -f "$DEPLOY_DIR/deploy/compose.yaml" "$@"
}

database_query() {
  compose exec -T db sh -ec 'exec psql -XAt --no-password -v ON_ERROR_STOP=1 --username="$POSTGRES_USER" --dbname="$POSTGRES_DB"' <<< "$1"
}

is_release_image() {
  [[ $1 =~ ^ghcr\.io/victoria-shaduro/personal-crm:[a-f0-9]{40}$ ]]
}

validate_image() {
  is_release_image "$IMAGE" || {
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

database_has_login() {
  database_query "SELECT CASE WHEN to_regclass('public.auth_user') IS NULL THEN '0' ELSE '1' END;"
}

image_has_login() {
  local label
  label=$(docker image inspect --format '{{index .Config.Labels "io.personal-crm.login-schema"}}' "$1") || return
  if [[ $label == 1 ]]; then echo 1; else echo 0; fi
}
