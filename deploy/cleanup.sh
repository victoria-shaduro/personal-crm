#!/usr/bin/env bash
set -Eeuo pipefail
source "$(dirname -- "$0")/common.sh"
select_environment prod
current=$(cat .current-image)
previous=''
[[ ! -f .previous-image ]] || previous=$(cat .previous-image)
staging_dir="$DEPLOY_DIR-staging"
staging_current=''
if [[ -d $staging_dir ]]; then
  exec 8>>"$staging_dir/.deploy.lock"
  flock -w 600 8
  [[ ! -f $staging_dir/.current-image ]] || staging_current=$(cat "$staging_dir/.current-image")
fi
cutoff=$(date -u -d '14 days ago' +%s)
images=$(docker image ls ghcr.io/victoria-shaduro/personal-crm --format '{{.Repository}}:{{.Tag}}')
while IFS= read -r image; do
  is_release_image "$image" || continue
  [[ $image != "$current" && $image != "$previous" && $image != "$staging_current" ]] || continue
  containers=$(docker ps -aq --filter "ancestor=$image")
  [[ -z $containers ]] || continue
  created=$(docker image inspect --format '{{.Created}}' "$image")
  if (( $(date -u -d "$created" +%s) < cutoff )); then
    docker image rm "$image"
  fi
done <<< "$images"
docker image prune --force \
  --filter 'label=org.opencontainers.image.source=https://github.com/victoria-shaduro/personal-crm' \
  --filter 'until=336h'
echo 'Old unused release images were cleaned up.'
