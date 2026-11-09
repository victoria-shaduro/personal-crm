#!/usr/bin/env bash
set -Eeuo pipefail
[[ $EUID == 0 ]] || { echo 'Run this script with sudo in your own terminal.' >&2; exit 1; }
config=/etc/nginx/sites-available/crm-app.conf
backup=/var/backups/personal-crm-nginx-$(date -u +%Y%m%dT%H%M%SZ).conf
cp -a "$config" "$backup"
python3 - "$config" <<'PY'
from pathlib import Path
import sys
path = Path(sys.argv[1])
text = path.read_text()
old = 'location / { try_files $uri $uri/ =404; }'
new = '''location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_read_timeout 60s;
    }'''
if 'proxy_pass http://127.0.0.1:3000;' not in text:
    if text.count(old) != 1:
        raise SystemExit('Unexpected application nginx configuration; no changes made.')
    path.write_text(text.replace(old, new))
PY
nginx -t
systemctl reload nginx
echo 'Application proxy enabled. Landing page configuration was not changed.'
