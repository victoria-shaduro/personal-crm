#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
: "${GITHUB_SHA:?}" "${GITHUB_REPOSITORY:?}" "${GITHUB_ACTOR:?}" "${GH_TOKEN:?}"
[[ $GITHUB_SHA =~ ^[a-f0-9]{40}$ ]] || exit 1
image="ghcr.io/${GITHUB_REPOSITORY,,}:$GITHUB_SHA"

if [[ ${1:-} == build ]]; then
  echo '::group::Code checks'
  npm install --global "$(node -p 'require("./package.json").packageManager')"
  pnpm install --frozen-lockfile
  pnpm exec next typegen
  pnpm lint
  pnpm typecheck
  echo '::endgroup::'

  echo '::group::Build and publish the commit image'
  printf '%s' "$GH_TOKEN" | docker login ghcr.io --username "$GITHUB_ACTOR" --password-stdin
  trap 'docker logout ghcr.io >/dev/null 2>&1 || true' EXIT
  docker buildx build --platform linux/amd64 --push \
    --build-arg "APP_REVISION=$GITHUB_SHA" \
    --tag "$image" \
    --cache-from "type=registry,ref=ghcr.io/${GITHUB_REPOSITORY,,}:buildcache" \
    --cache-to "type=registry,ref=ghcr.io/${GITHUB_REPOSITORY,,}:buildcache,mode=max" .
  echo '::endgroup::'
  exit 0
fi

: "${DEPLOY_SSH_KEY:?}" "${DEPLOY_KNOWN_HOSTS:?}" "${DEPLOY_HOST:?}" "${DEPLOY_USER:?}" "${DEPLOY_DIR:?}"
[[ $DEPLOY_DIR =~ ^(/[a-zA-Z0-9_-]+)+$ ]] || exit 1
project=${1:?Deployment environment is required}
case "$project" in
  prod) : "${PUBLIC_HEALTH_URL:?}"; [[ $PUBLIC_HEALTH_URL =~ ^https://[a-zA-Z0-9.-]+/health$ ]] || exit 1 ;;
  staging) DEPLOY_DIR+=-staging; PUBLIC_HEALTH_URL='' ;;
  *) echo "Unknown deployment environment: $project" >&2; exit 1 ;;
esac

task_tmp=$(mktemp -d)
remote_release=''
printf '%s\n' "$DEPLOY_SSH_KEY" > "$task_tmp/key"
printf '%s\n' "$DEPLOY_KNOWN_HOSTS" > "$task_tmp/known_hosts"
chmod 600 "$task_tmp/key" "$task_tmp/known_hosts"
unset DEPLOY_SSH_KEY DEPLOY_KNOWN_HOSTS
ssh_opts=(-i "$task_tmp/key" -o BatchMode=yes -o IdentitiesOnly=yes
  -o StrictHostKeyChecking=yes -o "UserKnownHostsFile=$task_tmp/known_hosts" -o ConnectTimeout=15)
target="$DEPLOY_USER@$DEPLOY_HOST"
cleanup() {
  if [[ $remote_release == "$DEPLOY_DIR"/.release.* ]]; then
    ssh "${ssh_opts[@]}" "$target" "rm -rf -- '$remote_release'" || true
  fi
  rm -rf -- "$task_tmp"
}
trap cleanup EXIT

echo "::group::Deploy $project"
remote_release=$(ssh "${ssh_opts[@]}" "$target" "umask 077; mkdir -p '$DEPLOY_DIR' && mktemp -d '$DEPLOY_DIR/.release.XXXXXXXX'")
tar -czf "$task_tmp/deploy.tar.gz" deploy
scp "${ssh_opts[@]}" "$task_tmp/deploy.tar.gz" "$target:$remote_release/deploy.tar.gz"
printf '%s' "$GH_TOKEN" | ssh "${ssh_opts[@]}" "$target" \
  "docker --config '$remote_release' login ghcr.io --username '$GITHUB_ACTOR' --password-stdin"
ssh "${ssh_opts[@]}" "$target" \
  "tar -xzf '$remote_release/deploy.tar.gz' -C '$remote_release' && CRM_DEPLOY_DIR='$DEPLOY_DIR' DOCKER_CONFIG='$remote_release' bash '$remote_release/deploy/run.sh' '$image' '$PUBLIC_HEALTH_URL' '$project' '$remote_release/deploy.tar.gz'"
echo '::endgroup::'
if [[ -n ${GITHUB_STEP_SUMMARY:-} ]]; then
  printf 'Deployed commit `%s` to `%s`. Migrations completed and the HTTPS health check returned HTTP 200 for this revision.\n' \
    "$GITHUB_SHA" "$project" >> "$GITHUB_STEP_SUMMARY"
fi
