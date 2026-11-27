#!/usr/bin/env bash
set -Eeuo pipefail
: "${GITHUB_REPOSITORY:?}" "${GH_TOKEN:?}"

repository=${GITHUB_REPOSITORY,,}
versions_url="/users/${repository%/*}/packages/container/${repository#*/}/versions"
old_versions=$(gh api --paginate --slurp "$versions_url?per_page=100&state=active" | jq -r '
  def release_tag: test("^[a-f0-9]{40}$");
  [ .[][] | select(any(.metadata.container.tags[]?; release_tag)) ]
  | sort_by(.created_at, .id) | reverse | .[10:][]
  | select(all(.metadata.container.tags[]; release_tag))
  | [.id, (.metadata.container.tags | join(", "))] | @tsv
')

while IFS=$'\t' read -r id tags; do
  [[ -n $id ]] || continue
  gh api --method DELETE --silent "$versions_url/$id"
  printf 'Deleted old GHCR build: %s\n' "$tags"
done <<< "$old_versions"
echo 'GHCR cleanup completed.'
