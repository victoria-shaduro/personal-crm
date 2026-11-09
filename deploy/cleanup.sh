#!/usr/bin/env bash
set -Eeuo pipefail
source "$(dirname -- "$0")/common.sh"
current=$(cat .current-image)
previous=''
[[ ! -f .previous-image ]] || previous=$(cat .previous-image)
while IFS= read -r image; do
  [[ $image == "$current" || $image == "$previous" ]] && continue
  # Never force removal of an image that another container still uses.
  docker image rm "$image"
done < <(docker image ls ghcr.io/victoria-shaduro/personal-crm --format '{{.Repository}}:{{.Tag}}')
docker image prune --force \
  --filter 'label=org.opencontainers.image.source=https://github.com/victoria-shaduro/personal-crm'
echo 'Image cleanup completed; current and previous releases retained.'
