#!/usr/bin/env bash
# ================================================================
# Amarktai Network — VPS Deployment Script
# Target: /var/www/html on a Noble LEMP stack (PHP 8.3, Nginx, MySQL)
#
# Usage:
#   chmod +x deploy.sh
#   ./deploy.sh
#
# Before running:
#   1. Edit includes/config.php with your real DB password and Qwen API key
#   2. Ensure this script is run from the project root
# ================================================================

set -euo pipefail

WEB_ROOT="/var/www/html"
DB_NAME="amarktainet1"
DB_USER="amarktainet1"

# Prompt for DB password rather than hardcoding it
if [ -z "${DB_PASS:-}" ]; then
  read -rsp "Enter MySQL password for user '$DB_USER': " DB_PASS
  echo ""
fi

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║   Amarktai Network — VPS Deployment          ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# ── 1. Copy files to web root ───────────────────────────────────────
echo "[1/6] Deploying files to $WEB_ROOT …"
sudo mkdir -p "$WEB_ROOT"/{api,admin,includes,database,assets}

sudo cp -r index.html about.html apps.html contact.html manifest.json sw.js "$WEB_ROOT/"
sudo cp -r api/*       "$WEB_ROOT/api/"
sudo cp -r admin/*     "$WEB_ROOT/admin/"
sudo cp -r includes/*  "$WEB_ROOT/includes/"
sudo cp -r database/*  "$WEB_ROOT/database/"

# Create the real config.php from the sample
if [ ! -f "$WEB_ROOT/includes/config.php" ]; then
  sudo cp "$WEB_ROOT/includes/config.sample.php" "$WEB_ROOT/includes/config.php"
  # Inject real DB password
  sudo sed -i "s/YOUR_DB_PASSWORD_HERE/$DB_PASS/g" "$WEB_ROOT/includes/config.php"
  echo "    config.php created with DB credentials"
fi

echo "    Files deployed ✓"

# ── 2. Set ownership & permissions ──────────────────────────────────
echo "[2/6] Setting permissions …"
sudo chown -R www-data:www-data "$WEB_ROOT"
sudo find "$WEB_ROOT" -type d -exec chmod 755 {} \;
sudo find "$WEB_ROOT" -type f -exec chmod 644 {} \;
# PHP files: no exec bit, readable by www-data only for sensitive dirs
sudo chmod 750 "$WEB_ROOT/admin"
sudo chmod 750 "$WEB_ROOT/includes"
echo "    Permissions set ✓"

# ── 3. Import database schema ────────────────────────────────────────
echo "[3/6] Importing database schema …"
sudo mysql -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" < database/schema.sql
echo "    Schema imported ✓"

# ── 4. Configure Nginx ───────────────────────────────────────────────
echo "[4/6] Writing Nginx config …"

# Auto-detect installed PHP-FPM version
PHP_FPM_SOCK=$(ls /var/run/php/php*-fpm.sock 2>/dev/null | sort -V | tail -1)
if [ -z "$PHP_FPM_SOCK" ]; then
  PHP_FPM_SOCK="/var/run/php/php8.3-fpm.sock"
  echo "    Warning: could not auto-detect PHP-FPM socket; defaulting to $PHP_FPM_SOCK"
fi
echo "    Using PHP-FPM socket: $PHP_FPM_SOCK"

sudo tee /etc/nginx/sites-available/amarktai > /dev/null <<NGINX
server {
    listen 80 default_server;
    listen [::]:80 default_server;

    root /var/www/html;
    index index.html index.php;

    server_name _;

    # Security headers
    add_header X-Content-Type-Options nosniff always;
    add_header X-Frame-Options SAMEORIGIN always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;

    # PHP via php-fpm
    location ~ \.php\$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:${PHP_FPM_SOCK};
        fastcgi_param SCRIPT_FILENAME \$document_root\$fastcgi_script_name;
        include fastcgi_params;
    }

    # Protect sensitive includes dir
    location /includes/ { deny all; return 404; }

    # Block direct DB access
    location /database/ { deny all; return 404; }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?|ttf)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # Service worker at root scope
    location /sw.js {
        add_header Cache-Control "no-cache";
    }

    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
NGINX

sudo ln -sf /etc/nginx/sites-available/amarktai /etc/nginx/sites-enabled/amarktai
# Remove default site if it exists
sudo rm -f /etc/nginx/sites-enabled/default

echo "    Nginx config written ✓"

# ── 5. Test & reload Nginx ───────────────────────────────────────────
echo "[5/6] Testing and reloading Nginx …"
sudo nginx -t && sudo systemctl reload nginx
echo "    Nginx reloaded ✓"

# ── 6. PHP-FPM status ────────────────────────────────────────────────
echo "[6/6] Checking PHP-FPM …"
PHP_FPM_SVC=$(systemctl list-units --type=service --state=active | grep -o 'php[0-9.]*-fpm' | head -1 || echo "php8.3-fpm")
sudo systemctl is-active "$PHP_FPM_SVC" || sudo systemctl start "$PHP_FPM_SVC"
echo "    PHP-FPM running ✓"

# ── Optional: generate & apply SRI hashes for CDN scripts ─────────────
# Uncomment the block below to add Subresource Integrity attributes to
# all CDN <script> tags. Requires curl + openssl on the VPS.
#
# echo "Generating SRI hashes for CDN scripts …"
# for html_file in "$WEB_ROOT"/*.html; do
#   while IFS= read -r line; do
#     if [[ "$line" =~ src=\"(https://[^\"]+\.js)\" ]]; then
#       url="${BASH_REMATCH[1]}"
#       hash=$(curl -fsSL "$url" | openssl dgst -sha384 -binary | openssl base64 -A)
#       sri="sha384-$hash"
#       sudo sed -i "s|src=\"$url\"|src=\"$url\" integrity=\"$sri\" crossorigin=\"anonymous\"|g" "$html_file"
#     fi
#   done < "$html_file"
# done
# echo "    SRI hashes applied ✓"

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  ✅  Deployment complete!                                ║"
echo "║                                                          ║"
echo "║  👉  Next steps:                                         ║"
echo "║  1. Set your credentials in config.php:                  ║"
echo "║     sudo nano /var/www/html/includes/config.php          ║"
echo "║     Set DB_PASS and QWEN_API_KEY                         ║"
echo "║                                                          ║"
echo "║  2. Download hero video (optional):                      ║"
echo "║     Place as /var/www/html/assets/hero.mp4               ║"
echo "║                                                          ║"
echo "║  3. (Recommended) Set up SSL with Certbot:               ║"
echo "║     sudo certbot --nginx                                 ║"
echo "║                                                          ║"
echo "║  4. Secret admin access:                                 ║"
echo "║     Click the AI orb → type 'show admin'                 ║"
echo "║     Then enter your admin password                       ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
