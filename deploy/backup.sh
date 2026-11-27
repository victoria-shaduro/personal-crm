#!/usr/bin/env bash

BACKUP_DIR="$(dirname -- "$DEPLOY_DIR")/personal-crm-backups"

installed_app_container() {
  local containers
  containers=$(docker ps --all --quiet \
    --filter label=com.docker.compose.project=prod \
    --filter label=com.docker.compose.service=app) || return
  if [[ $containers == *$'\n'* ]]; then
    echo 'Expected a single production application container.' >&2
    return 1
  fi
  printf '%s\n' "$containers"
}

backup_database() (
  set -e
  local revision=$1 kind=$2 timestamp archive partial
  mkdir -p -- "$BACKUP_DIR"
  if [[ -L $BACKUP_DIR || ! -O $BACKUP_DIR ]]; then
    echo 'The backup directory must belong to the deploy user and be a real directory.' >&2
    exit 1
  fi
  chmod 700 -- "$BACKUP_DIR"
  timestamp=$(date -u +%Y%m%dT%H%M%S.%NZ)
  if [[ $kind == deploy ]]; then
    archive="$BACKUP_DIR/$timestamp-$revision.dump"
  else
    archive="$BACKUP_DIR/$timestamp-$kind-$revision.dump"
  fi
  if [[ -e $archive || -L $archive ]]; then
    echo "Backup already exists: $archive" >&2
    exit 1
  fi
  partial=$(mktemp -- "$BACKUP_DIR/.backup.XXXXXXXX")
  trap 'rm -f -- "$partial"' EXIT
  compose exec -T db sh -ec '
    exec pg_dump --no-password --format=custom --username="$POSTGRES_USER" --dbname="$POSTGRES_DB"
  ' >"$partial"
  if [[ ! -s $partial ]]; then
    echo 'Database backup produced an empty file.' >&2
    exit 1
  fi
  mv -- "$partial" "$archive"
  printf '%s\n' "$archive"
)

backup_production() {
  local kind=$1 container prior_image revision=unversioned db_container volume archive
  container=$(installed_app_container)
  if [[ -n $container ]]; then
    prior_image=$(docker inspect --format '{{.Config.Image}}' "$container")
  elif [[ -f .current-image ]]; then
    prior_image=$(cat .current-image)
  elif [[ $kind == daily ]]; then
    echo 'No production application revision is recorded for the daily backup.' >&2
    return 1
  else
    prior_image=''
    db_container=$(compose ps --all --quiet db)
    volume=$(docker volume ls --quiet --filter 'name=^prod_postgres-data$')
    if [[ -z $db_container && -z $volume && ! -f .previous-image ]]; then
      echo 'No production database exists yet. Skipping backup on first deployment.'
      return
    fi
  fi
  if [[ -n $container || -f .current-image ]]; then
    if ! is_release_image "$prior_image"; then
      echo 'Could not determine the installed application revision for the database backup.' >&2
      return 1
    fi
    revision=${prior_image##*:}
  fi
  if [[ $kind == daily ]]; then
    IMAGE=$prior_image
    validate_image
  fi
  echo "Backing up the production database ($kind) for revision $revision."
  archive=$(backup_database "$revision" "$kind")
  echo "Database backup completed: $archive"
  prune_backups "$kind"
}

prune_backups() (
  [[ -d $BACKUP_DIR && ! -L $BACKUP_DIR && -O $BACKUP_DIR ]] || exit 0
  local LC_ALL=C archive index prefix=''
  local -a archives=()
  [[ $1 != daily ]] || prefix='daily-'
  shopt -s nullglob
  for archive in "$BACKUP_DIR"/*.dump; do
    [[ -f $archive && ! -L $archive ]] || continue
    if [[ ${archive##*/} =~ ^[0-9]{8}T[0-9]{6}\.[0-9]{9}Z-${prefix}([a-f0-9]{40}|unversioned)\.dump$ ]]; then
      archives+=("$archive")
    fi
  done
  for ((index = 0; index < ${#archives[@]} - 7; index++)); do
    rm -- "${archives[index]}"
  done
)

if [[ ${BASH_SOURCE[0]} == "$0" ]]; then
  set -Eeuo pipefail
  [[ ${1:-} == daily ]] || { echo 'Usage: bash deploy/backup.sh daily' >&2; exit 1; }
  source "$(dirname -- "$0")/common.sh"
  select_environment prod
  require_env
  lock_deployment
  require_no_pending_restore
  backup_production daily
fi
