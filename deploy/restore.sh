#!/usr/bin/env bash
set -Eeuo pipefail
if [[ $# != 1 || ! -t 0 ]]; then
  echo 'Usage from a server terminal: bash deploy/restore.sh <backup-file>' >&2
  exit 1
fi
backup_file=$(realpath -e -- "$1")
if [[ ! -f $backup_file || ! -r $backup_file || ! -s $backup_file ]]; then
  echo "Backup must be a readable, nonempty file: $backup_file" >&2
  exit 1
fi
source "$(dirname -- "$0")/common.sh"
source deploy/backup.sh
require_env
lock_deployment

app_container=$(installed_app_container)
if [[ -z $app_container ]]; then
  echo 'Restore requires the existing production application container.' >&2
  exit 1
fi
IMAGE=$(docker inspect --format '{{.Config.Image}}' "$app_container")
validate_image
PUBLIC_HEALTH_URL=${PUBLIC_HEALTH_URL:-$DEFAULT_PUBLIC_HEALTH_URL}
database=$(compose exec -T db sh -ec 'printf "%s\n" "${POSTGRES_DB:?}"')
compose exec -T db pg_restore --file=/dev/null <"$backup_file"

catalog=$(compose exec -T db pg_restore --list <"$backup_file")
archive_schema=0
if [[ $catalog == *' TABLE public auth_user '* ]]; then archive_schema=1; fi
target_schema=$(image_has_login "$IMAGE")
if [[ $archive_schema != "$target_schema" ]]; then
  echo 'Select a backup that matches the schema of the installed application image.' >&2
  exit 1
fi
printf 'Application image after restore: %s\n' "$IMAGE"
printf 'Backup file: %s\nDatabase to replace in Docker Compose project prod: %s\n' "$backup_file" "$database"
printf 'Type yes to replace the database: '
if ! IFS= read -r confirmation || [[ $confirmation != yes ]]; then
  echo 'Restore cancelled.'
  exit 0
fi

safety_backup=''
trap '
  echo "Restore failed." >&2
  if [[ -f $RESTORE_STATE ]]; then
    echo "Run deploy/restore.sh again to finish the restore before starting the application." >&2
    if [[ -n $safety_backup ]]; then
      echo "Safety backup: $safety_backup" >&2
    fi
  fi
' ERR

if [[ -f $RESTORE_STATE ]]; then
  safety_backup=$(cat -- "$RESTORE_STATE")
  if [[ ! -f $safety_backup || ! -r $safety_backup || ! -s $safety_backup ]]; then
    echo "Cannot resume without the original safety backup: $safety_backup" >&2
    exit 1
  fi
  echo "Resuming an interrupted restore. Safety backup: $safety_backup"
else
  safety_backup=$(backup_database "${IMAGE##*:}" restore)
  echo "Safety backup completed: $safety_backup"
fi

compose stop app
printf '%s\n' "$safety_backup" >"$RESTORE_STATE.tmp"
mv -- "$RESTORE_STATE.tmp" "$RESTORE_STATE"
compose exec -T db sh -ec '
  dropdb --no-password --if-exists --username="$POSTGRES_USER" -- "$POSTGRES_DB"
  createdb --no-password --template=template0 --username="$POSTGRES_USER" -- "$POSTGRES_DB"
'
compose exec -T db sh -ec '
  exec pg_restore --no-password --single-transaction --username="$POSTGRES_USER" --dbname="$POSTGRES_DB"
' <"$backup_file"
compose start app
bash deploy/smoke.sh "${IMAGE##*:}" "$PUBLIC_HEALTH_URL"
rm -- "$RESTORE_STATE"
echo "Database restore completed: $backup_file"
