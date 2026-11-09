#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
: "${GITHUB_SHA:?}" "${GITHUB_REPOSITORY:?}" "${GITHUB_ACTOR:?}" "${GH_TOKEN:?}"
: "${DEPLOY_SSH_KEY:?}" "${DEPLOY_KNOWN_HOSTS:?}" "${DEPLOY_HOST:?}" "${DEPLOY_USER:?}"
: "${DEPLOY_DIR:?}" "${PUBLIC_HEALTH_URL:?}"
[[ $GITHUB_SHA =~ ^[a-f0-9]{40}$ && $DEPLOY_DIR =~ ^/[a-zA-Z0-9_/-]+$ ]] || exit 1
image="ghcr.io/${GITHUB_REPOSITORY,,}:$GITHUB_SHA"
task_tmp=$(mktemp -d)
remote_auth="$DEPLOY_DIR/.registry-$GITHUB_SHA-${GITHUB_RUN_ID:?}"
registry_config=${DOCKER_CONFIG:-$HOME/.docker}
printf '%s\n' "$DEPLOY_SSH_KEY" > "$task_tmp/key"
printf '%s\n' "$DEPLOY_KNOWN_HOSTS" > "$task_tmp/known_hosts"
chmod 600 "$task_tmp/key" "$task_tmp/known_hosts"
unset DEPLOY_SSH_KEY DEPLOY_KNOWN_HOSTS
ssh_opts=(-i "$task_tmp/key" -o BatchMode=yes -o IdentitiesOnly=yes
  -o StrictHostKeyChecking=yes -o "UserKnownHostsFile=$task_tmp/known_hosts" -o ConnectTimeout=15)
target="$DEPLOY_USER@$DEPLOY_HOST"
cleanup() {
  ssh "${ssh_opts[@]}" "$target" "rm -rf -- '$remote_auth'" || true
  docker logout ghcr.io >/dev/null 2>&1 || true
  rm -rf -- "$task_tmp"
}
trap cleanup EXIT

echo '::group::Code checks'
npm install --global "$(node -p 'require("./package.json").packageManager')"
pnpm install --frozen-lockfile
pnpm exec next typegen
pnpm lint
pnpm typecheck
echo '::endgroup::'

echo '::group::Build and publish the commit image'
printf '%s' "$GH_TOKEN" | docker login ghcr.io --username "$GITHUB_ACTOR" --password-stdin
docker buildx build --platform linux/amd64 --push \
  --build-arg "APP_REVISION=$GITHUB_SHA" \
  --tag "$image" \
  --cache-from "type=registry,ref=ghcr.io/${GITHUB_REPOSITORY,,}:buildcache" \
  --cache-to "type=registry,ref=ghcr.io/${GITHUB_REPOSITORY,,}:buildcache,mode=max" .
echo '::endgroup::'

echo '::group::Deploy migrations, application and public smoke check'
ssh "${ssh_opts[@]}" "$target" "umask 077; mkdir -p '$DEPLOY_DIR' '$remote_auth'"
tar -czf - deploy | ssh "${ssh_opts[@]}" "$target" "tar -xzf - -C '$DEPLOY_DIR'"
scp "${ssh_opts[@]}" "$registry_config/config.json" "$target:$remote_auth/config.json"
ssh "${ssh_opts[@]}" "$target" \
  "cd '$DEPLOY_DIR' && DOCKER_CONFIG='$remote_auth' bash deploy/run.sh '$image' '$PUBLIC_HEALTH_URL'"
echo '::endgroup::'
if [[ -n ${GITHUB_STEP_SUMMARY:-} ]]; then
  printf 'Deployed commit `%s`. Migrations completed; public [/health](%s) returned HTTP 200 for this revision.\n' \
    "$GITHUB_SHA" "$PUBLIC_HEALTH_URL" >> "$GITHUB_STEP_SUMMARY"
fi
