#!/usr/bin/env bash
set -Eeuo pipefail
expected_revision=${1:?Expected commit SHA is required}
health_url=${2:?Public HTTPS health URL is required}
[[ $expected_revision =~ ^[a-f0-9]{40}$ && $health_url == https://* ]] || exit 1
curl_options=(--silent --show-error --connect-timeout 5 --max-time 15)
if [[ ${3:-prod} == staging ]]; then
  public_status=$(curl "${curl_options[@]}" --noproxy '*' --output /dev/null --write-out '%{http_code}' "$health_url")
  if [[ $public_status != 401 ]]; then
    printf 'Staging must require a password from external visitors (HTTP %s).\n' "$public_status" >&2
    exit 1
  fi
  hostname=${health_url#https://}
  curl_options+=(--noproxy '*' --resolve "${hostname%%/*}:443:127.0.0.1")
fi
body=$(mktemp)
trap 'rm -f "$body"' EXIT
for attempt in {1..20}; do
  status=$(curl "${curl_options[@]}" \
    --output "$body" --write-out '%{http_code}' "$health_url") || status=000
  if [[ $status == 200 ]] && python3 - "$body" "$expected_revision" <<'PY'
import json, sys
try:
    with open(sys.argv[1]) as response:
        body = json.load(response)
    assert body.get('status') == 'ok' and body.get('revision') == sys.argv[2]
except (ValueError, OSError, AssertionError):
    sys.exit(1)
PY
  then
    printf '/health HTTP 200 revision=%s (database and tables available)\n' "$expected_revision"
    exit 0
  fi
  printf 'Smoke attempt %s/20: HTTP %s; waiting for the expected revision.\n' "$attempt" "$status"
  sleep 3
done
echo 'Smoke failed. Deployment failed; no automatic rollback was performed.' >&2
exit 1
