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
  if manifest=$(docker buildx imagetools inspect "$image" 2>&1); then
    echo "Using the already published image: $image"
    echo '::endgroup::'
    exit 0
  elif [[ $manifest != *'not found'* && $manifest != *'manifest unknown'* ]]; then
    printf '%s\n' "$manifest" >&2
    exit 1
  fi
  docker buildx build --platform linux/amd64 --push \
    --build-arg "APP_REVISION=$GITHUB_SHA" \
    --tag "$image" \
    --cache-from "type=registry,ref=ghcr.io/${GITHUB_REPOSITORY,,}:buildcache" \
    --cache-to "type=registry,ref=ghcr.io/${GITHUB_REPOSITORY,,}:buildcache,mode=max" .
  echo '::endgroup::'
  exit 0
fi

find_staged_revision() {
  local requested=$1 runs run_id sha updated_at completed_at latest='' revision=''
  local -a filters=(-f branch=main -f event=push -f status=completed -F per_page=100)
  if [[ -n $requested ]]; then
    [[ $requested =~ ^[a-f0-9]{40}$ ]] || { echo 'Enter a full commit SHA.' >&2; return 1; }
    filters+=(-f "head_sha=$requested")
  fi
  runs=$(gh api --method GET --paginate "repos/$GITHUB_REPOSITORY/actions/workflows/deploy.yml/runs" \
    "${filters[@]}" --jq '.workflow_runs[] | [.id, .head_sha, .updated_at] | @tsv') || return

  # Use the staging job's finish time so successful reruns count in deployment order.
  while IFS=$'\t' read -r run_id sha updated_at; do
    [[ -n $run_id ]] || continue
    [[ $updated_at > $latest ]] || break
    completed_at=$(gh api --paginate "repos/$GITHUB_REPOSITORY/actions/runs/$run_id/jobs?filter=all&per_page=100" \
      --jq '.jobs[] | select(.name == "Deploy staging" and .conclusion == "success") | .completed_at' \
      | LC_ALL=C sort -r | sed -n '1p') || return
    if [[ $completed_at > $latest ]]; then
      latest=$completed_at
      revision=$sha
    fi
  done < <(LC_ALL=C sort -t $'\t' -k3,3r <<< "$runs")

  if [[ ! $revision =~ ^[a-f0-9]{40}$ ]]; then
    echo "No successful staging deployment found for ${requested:-main}." >&2
    return 1
  fi
  printf '%s\n' "$revision"
}

: "${DEPLOY_SSH_KEY:?}" "${DEPLOY_KNOWN_HOSTS:?}" "${DEPLOY_HOST:?}" "${DEPLOY_USER:?}" "${DEPLOY_DIR:?}"
[[ $DEPLOY_DIR =~ ^(/[a-zA-Z0-9_-]+)+$ ]] || exit 1
project=${1:?Deployment environment is required}
rollback=false
case "$project" in
  prod)
    [[ ${GITHUB_REF:-} == refs/heads/main ]] || { echo 'Run Deploy prod from main.' >&2; exit 1; }
    : "${PUBLIC_HEALTH_URL:?}"
    [[ $PUBLIC_HEALTH_URL =~ ^https://[a-zA-Z0-9.-]+/health$ ]] || exit 1
    rollback=${PROD_ROLLBACK:-false}
    if [[ $rollback != true ]]; then
      revision=$(find_staged_revision "${PROD_SHA:-}")
      image="${image%:*}:$revision"
      echo "Selected commit from staging deployment history: $revision"
    fi
    ;;
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
remote_scripts="tar -xzf '$remote_release/deploy.tar.gz' -C '$remote_release' && CRM_DEPLOY_DIR='$DEPLOY_DIR'"
if [[ $rollback == true ]]; then
  ssh "${ssh_opts[@]}" "$target" \
    "$remote_scripts PUBLIC_HEALTH_URL='$PUBLIC_HEALTH_URL' bash '$remote_release/deploy/rollback.sh' '' prod '$remote_release/deploy.tar.gz'" \
    | tee "$task_tmp/rollback.log"
  image=$(sed -n 's/^Manual rollback completed: //p' "$task_tmp/rollback.log")
  [[ ${image%:*} == "ghcr.io/${GITHUB_REPOSITORY,,}" && ${image##*:} =~ ^[a-f0-9]{40}$ ]]
else
  printf '%s' "$GH_TOKEN" | ssh "${ssh_opts[@]}" "$target" \
    "docker --config '$remote_release' login ghcr.io --username '$GITHUB_ACTOR' --password-stdin"
  ssh "${ssh_opts[@]}" "$target" \
    "$remote_scripts DOCKER_CONFIG='$remote_release' bash '$remote_release/deploy/run.sh' '$image' '$PUBLIC_HEALTH_URL' '$project' '$remote_release/deploy.tar.gz'"
fi
echo '::endgroup::'
if [[ -n ${GITHUB_STEP_SUMMARY:-} ]]; then
  if [[ $rollback == true ]]; then
    printf 'Rolled production back to commit `%s`. The HTTPS health check returned HTTP 200 for this revision.\n' \
      "${image##*:}" >> "$GITHUB_STEP_SUMMARY"
  else
    printf 'Deployed commit `%s` to `%s`. Migrations completed and the HTTPS health check returned HTTP 200 for this revision.\n' \
      "${image##*:}" "$project" >> "$GITHUB_STEP_SUMMARY"
  fi
fi
