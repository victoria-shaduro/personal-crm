#!/usr/bin/env bash
set -Eeuo pipefail
source "$(dirname -- "$0")/common.sh"
select_environment prod
current=$(cat .current-image)
previous=''
[[ ! -f .previous-image ]] || previous=$(cat .previous-image)
staging_dir="$DEPLOY_DIR-staging"
staging_current=''
staging_previous=''
if [[ -d $staging_dir ]]; then
  exec 8>>"$staging_dir/.deploy.lock"
  if ! flock -n 8; then
    echo 'Image cleanup skipped while staging is busy.'
    exit 0
  fi
  [[ ! -f $staging_dir/.current-image ]] || staging_current=$(cat "$staging_dir/.current-image")
  [[ ! -f $staging_dir/.previous-image ]] || staging_previous=$(cat "$staging_dir/.previous-image")
fi
cutoff=$(date -u -d '14 days ago' +%s)
while IFS= read -r image; do
  [[ $image == "$current" || $image == "$previous" || $image == "$staging_current" || $image == "$staging_previous" ]] && continue
  [[ -z $(docker ps -aq --filter "ancestor=$image") ]] || continue
  created=$(docker image inspect --format '{{.Created}}' "$image")
  if (( $(date -u -d "$created" +%s) < cutoff )); then
    docker image rm "$image"
  fi
done < <(docker image ls ghcr.io/victoria-shaduro/personal-crm --format '{{.Repository}}:{{.Tag}}')
docker image prune --force \
  --filter 'label=org.opencontainers.image.source=https://github.com/victoria-shaduro/personal-crm' \
  --filter 'until=336h'
echo 'Old unused release images were cleaned up.'
