#!/usr/bin/env bash
set -Eeuo pipefail
[[ $EUID == 0 ]] || { echo 'Run this script with sudo in your own terminal.' >&2; exit 1; }
hostname=test-app.xn----7sbgnddegvj7a8c6i.xn--p1ai
config=/etc/nginx/sites-available/personal-crm-staging.conf
enabled=/etc/nginx/sites-enabled/personal-crm-staging.conf
password_file=/etc/nginx/personal-crm-staging.htpasswd
webroot=/var/www/personal-crm-staging-acme
header='# Managed by personal-crm staging setup'

if [[ -e $config || -L $config ]]; then
  [[ -f $config && ! -L $config && $(head -n 1 "$config") == "$header" ]] || {
    echo "Unexpected configuration file: $config" >&2
    exit 1
  }
fi
if [[ -e $enabled || -L $enabled ]]; then
  [[ -L $enabled && $(readlink "$enabled") == "$config" ]] || {
    echo "Unexpected site link: $enabled" >&2
    exit 1
  }
fi

[[ ! -L $password_file ]] || { echo "Unexpected password file: $password_file" >&2; exit 1; }
if [[ ! -f $password_file ]]; then
  echo 'Choose the browser password for the staging user.'
  hash=$(openssl passwd -6)
  [[ $hash == '$6$'* ]] || exit 1
  password_tmp=$(mktemp)
  trap 'rm -f -- "$password_tmp"' EXIT
  printf 'staging:%s\n' "$hash" > "$password_tmp"
  unset hash
  install -o root -g www-data -m 640 "$password_tmp" "$password_file"
  rm -f -- "$password_tmp"
fi

install -d -m 755 "$webroot"
config_tmp=$(mktemp -- "$config.XXXXXXXX")
trap 'rm -f -- "$config_tmp"' EXIT
write_http_config() {
  cat <<'NGINX'
# Managed by personal-crm staging setup
server {
    listen 80;
    listen [::]:80;
    server_name test-app.xn----7sbgnddegvj7a8c6i.xn--p1ai;

    location ^~ /.well-known/acme-challenge/ {
        root /var/www/personal-crm-staging-acme;
        try_files $uri =404;
    }
    location / {
        return 301 https://$server_name$request_uri;
    }
}
NGINX
}
install_config() {
  chmod 644 "$config_tmp"
  mv -- "$config_tmp" "$config"
  [[ -L $enabled ]] || ln -s -- "$config" "$enabled"
  nginx -t
  systemctl reload nginx
}

if [[ ! -f $config ]]; then
  write_http_config > "$config_tmp"
  install_config
fi

certbot certonly --webroot -w "$webroot" -d "$hostname" --cert-name "$hostname" \
  --keep-until-expiring --non-interactive --agree-tos --deploy-hook 'systemctl reload nginx'

write_http_config > "$config_tmp"
cat >> "$config_tmp" <<'NGINX'

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name test-app.xn----7sbgnddegvj7a8c6i.xn--p1ai;
    ssl_certificate /etc/letsencrypt/live/test-app.xn----7sbgnddegvj7a8c6i.xn--p1ai/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/test-app.xn----7sbgnddegvj7a8c6i.xn--p1ai/privkey.pem;

    auth_basic "CRM staging";
    auth_basic_user_file /etc/nginx/personal-crm-staging.htpasswd;

    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header Authorization "";
    proxy_buffering off;

    location / {
        proxy_pass http://127.0.0.1:3001;
    }
    location = /health {
        satisfy any;
        allow 127.0.0.1;
        deny all;
        proxy_pass http://127.0.0.1:3001;
    }
}
NGINX
install_config
echo "HTTPS and password protection configured for $hostname."
