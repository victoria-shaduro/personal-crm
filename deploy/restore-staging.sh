#!/usr/bin/env bash
set -Eeuo pipefail
source "$(dirname -- "$0")/common.sh"
select_environment staging
IMAGE=${1:?A locally available application image is required}
validate_image
require_env
lock_deployment

export LC_ALL=C
shopt -s nullglob
backup=''
for candidate in "$BACKUP_DIR"/*.dump; do
  if [[ ${candidate##*/} != *-restore-* && -f $candidate && ! -L $candidate && -s $candidate ]]; then
    backup=$candidate
  fi
done
[[ -n $backup ]] || { echo 'No production database backup found.' >&2; exit 1; }

compose up -d --wait --wait-timeout 120 db
if [[ $(database_query "SELECT NOT EXISTS (SELECT FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname !~ '^pg_' AND n.nspname <> 'information_schema');") != t ]]; then
  echo 'The staging database already contains data or schema objects.' >&2
  exit 1
fi

echo "Loading production backup into the empty staging database: ${backup##*/}"
compose exec -T db bash -ec '
  umask 077
  work=$(mktemp -d)
  trap '\''rm -rf -- "$work"'\'' EXIT
  cat > "$work/backup.dump"
  set -o pipefail
  pg_restore --list "$work/backup.dump" |
    sed -E "/ TABLE DATA public (auth_account|auth_session|auth_verification|mail_delivery) /s/^/;/" > "$work/restore.list"
  pg_restore --no-password --single-transaction --no-owner --no-privileges \
    --use-list="$work/restore.list" --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" "$work/backup.dump"
' < "$backup"
echo 'Staging database restored.'
