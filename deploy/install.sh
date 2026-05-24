#!/usr/bin/env bash
# PrintCare — установка на VPS, где уже работает другая CRM.
# Использует Node + npm + PM2 + Nginx. Текущую CRM не трогает.
#
# Использование:
#   curl -fsSL https://raw.githubusercontent.com/AlexPechatnik/Daniya/main/deploy/install.sh | sudo bash
# или:
#   git clone https://github.com/AlexPechatnik/Daniya.git /tmp/printcare-installer
#   sudo bash /tmp/printcare-installer/deploy/install.sh

set -euo pipefail

# ── Конфигурация ──────────────────────────────────────────────────────────
APP_DIR="/var/www/printer-service"
PM2_NAME="printer-service"
PORT="3001"
DOMAIN="service.kopik-system.online"
EMAIL="${CERTBOT_EMAIL:-cg.alexander.kalugin@gmail.com}"
REPO="https://github.com/AlexPechatnik/Daniya.git"
BRANCH="main"
TELEGRAM_BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-}"
if [[ -z "$TELEGRAM_BOT_TOKEN" ]]; then
  echo "TELEGRAM_BOT_TOKEN не задан. Запустите так:"
  echo "  TELEGRAM_BOT_TOKEN='ваш:токен' sudo -E bash $0"
  exit 1
fi

# Чужие пути (только для проверки, что не трогаем) — менять не нужно
EXISTING_CRM_DIR="/var/www/crm"
EXISTING_CRM_PORT="3000"

# ── Утилиты ───────────────────────────────────────────────────────────────
C_OK="\033[32m"; C_WARN="\033[33m"; C_ERR="\033[31m"; C_STEP="\033[1;36m"; C_OFF="\033[0m"
ok()   { printf "${C_OK}✓${C_OFF} %s\n" "$*"; }
warn() { printf "${C_WARN}⚠${C_OFF}  %s\n" "$*"; }
err()  { printf "${C_ERR}✖${C_OFF} %s\n" "$*"; }
step() { printf "\n${C_STEP}▸ %s${C_OFF}\n" "$*"; }
require_cmd() { command -v "$1" >/dev/null || { err "не найдена команда: $1"; exit 1; }; }

# ── Safety guards ─────────────────────────────────────────────────────────
[[ $EUID -eq 0 ]] || { err "Запустите от root (sudo bash $0)"; exit 1; }
[[ "$PWD" != "$EXISTING_CRM_DIR"* ]] || { err "Не запускайте из $EXISTING_CRM_DIR"; exit 1; }

# ── Step 0: pre-flight ────────────────────────────────────────────────────
step "Step 0 — Проверка окружения"
require_cmd node
require_cmd npm
require_cmd pm2
require_cmd nginx
require_cmd git
require_cmd curl
require_cmd ss

NODE_VER=$(node -v)
ok "node $NODE_VER · npm $(npm -v) · pm2 $(pm2 -v)"

# 3001 свободен
if ss -tlnp 2>/dev/null | grep -q ":$PORT "; then
  err "Порт $PORT занят:"
  ss -tlnp | grep ":$PORT "
  exit 1
fi
ok "порт $PORT свободен"

# 3000 — НЕ трогаем (это текущая CRM)
if ss -tlnp 2>/dev/null | grep -q ":$EXISTING_CRM_PORT "; then
  ok "порт $EXISTING_CRM_PORT — текущая CRM, не трогаем"
fi

# DNS
DNS_IP=$(getent hosts "$DOMAIN" | awk '{print $1}' | head -1)
[[ -n "$DNS_IP" ]] || { err "DNS $DOMAIN не резолвится. Проверьте A-запись."; exit 1; }
ok "DNS: $DOMAIN → $DNS_IP"

# Если каталог существует
if [[ -d "$APP_DIR" ]]; then
  warn "$APP_DIR уже существует"
  read -rp "  Снести и переустановить? [y/N] " ans
  if [[ "$ans" =~ ^[Yy]$ ]]; then
    pm2 delete "$PM2_NAME" 2>/dev/null || true
    rm -rf "$APP_DIR"
    ok "очищено"
  else
    err "Отмена. Если нужно обновить — используйте deploy/update.sh"
    exit 1
  fi
fi

# ── Step 1: clone ─────────────────────────────────────────────────────────
step "Step 1 — Клонирование репо"
mkdir -p "$(dirname "$APP_DIR")"
git clone --depth=1 -b "$BRANCH" "$REPO" "$APP_DIR"
cd "$APP_DIR"
ok "склонировано → $APP_DIR"

# ── Step 2: deps ──────────────────────────────────────────────────────────
step "Step 2 — Установка зависимостей (~1–2 мин)"
npm ci --no-audit --no-fund
ok "зависимости установлены"

# ── Step 3: .env ──────────────────────────────────────────────────────────
step "Step 3 — Генерация .env"
SESSION_PASS=$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")

# Узнать username бота через getMe, чтобы публичные кнопки сразу появились
TG_USERNAME=$(curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe" \
  | grep -oP '"username":"\K[^"]+' | head -1 || true)
[[ -n "$TG_USERNAME" ]] && ok "Telegram бот: @$TG_USERNAME" || warn "Не удалось получить username бота"

cat > "$APP_DIR/.env" <<EOF
DATABASE_URL="file:./prisma/dev.db"
SESSION_PASSWORD="$SESSION_PASS"
PUBLIC_BASE_URL="https://$DOMAIN"

TELEGRAM_BOT_TOKEN="$TELEGRAM_BOT_TOKEN"
TELEGRAM_WEBHOOK_SECRET=""
TELEGRAM_ADMIN_CHAT_ID=""
NEXT_PUBLIC_TELEGRAM_BOT_USERNAME="$TG_USERNAME"

MAX_BOT_TOKEN=""
MAX_WEBHOOK_SECRET=""
MAX_ADMIN_CHAT_ID=""
NEXT_PUBLIC_MAX_BOT_USERNAME=""

COMPANY_PHONE="+7 (965) 022-42-99"
COMPANY_EMAIL="info@printcare.ru"
COMPANY_CITY="Санкт-Петербург"

NODE_ENV=production
PORT=$PORT
HOSTNAME=127.0.0.1
EOF
chmod 600 "$APP_DIR/.env"
ok ".env создан (chmod 600)"

# ── Step 4: prisma ────────────────────────────────────────────────────────
step "Step 4 — Prisma: схема + seed"
npx prisma generate
npx prisma db push --accept-data-loss
npm run db:seed || warn "Seed упал, запустите вручную: cd $APP_DIR && npm run db:seed"
ok "БД: $APP_DIR/prisma/dev.db"

# ── Step 5: build ─────────────────────────────────────────────────────────
step "Step 5 — Production build (это 1–3 мин)"
npm run build
ok "build готов"

# Standalone сборка кладёт server.js в .next/standalone, нужно дополнить
cp -r public .next/standalone/public 2>/dev/null || true
mkdir -p .next/standalone/.next
cp -r .next/static .next/standalone/.next/static
mkdir -p .next/standalone/node_modules
cp -r node_modules/.prisma .next/standalone/node_modules/.prisma 2>/dev/null || true
cp -r node_modules/@prisma .next/standalone/node_modules/@prisma 2>/dev/null || true
rm -rf .next/standalone/prisma
mkdir -p .next/standalone/prisma
cp prisma/schema.prisma .next/standalone/prisma/schema.prisma
cp .env .next/standalone/.env
ok "standalone bundle собран"

# ── Step 6: PM2 ───────────────────────────────────────────────────────────
step "Step 6 — PM2"
pm2 delete "$PM2_NAME" 2>/dev/null || true
cd "$APP_DIR/.next/standalone"
# КРИТИЧНО: PORT и HOSTNAME передаём явно через env префикс — Next.js standalone
# не читает .env сам, а дефолт у него 0.0.0.0:3000, что может убить соседний сервис.
# --node-args="--env-file=.env" — чтобы остальные переменные (DATABASE_URL и т.д.) подхватились.
PORT=$PORT HOSTNAME=127.0.0.1 NODE_ENV=production \
  pm2 start server.js \
    --name "$PM2_NAME" \
    --node-args="--env-file=.env" \
    --cwd "$APP_DIR/.next/standalone" \
    --update-env
cd "$APP_DIR"
pm2 save

# pm2 startup — настройка автозапуска при ребуте, только если ещё не настроен
if ! systemctl is-enabled pm2-root.service >/dev/null 2>&1; then
  pm2 startup systemd -u root --hp /root | grep -E '^(sudo )?env' | sh || warn "pm2 startup нужно настроить вручную"
fi
sleep 2

# Проверка
if ss -tlnp 2>/dev/null | grep -q ":$PORT "; then
  ok "приложение слушает $PORT"
else
  err "приложение не запустилось. Логи: pm2 logs $PM2_NAME --lines 50"
  pm2 logs "$PM2_NAME" --lines 30 --nostream
  exit 1
fi

# ── Step 7: nginx ─────────────────────────────────────────────────────────
step "Step 7 — Nginx (поддомен)"
NGINX_CONF="/etc/nginx/sites-available/$DOMAIN"

# Не перезаписываем чужие конфиги без подтверждения
if [[ -f "$NGINX_CONF" ]]; then
  warn "Уже существует $NGINX_CONF"
  read -rp "  Перезаписать? [y/N] " ans
  [[ "$ans" =~ ^[Yy]$ ]] || { err "Отмена"; exit 1; }
fi

cat > "$NGINX_CONF" <<EOF
# PrintCare — поддомен service.kopik-system.online.
# Создан install.sh — \$(date -Iseconds).
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;

    client_max_body_size 20m;

    location / {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 60s;
    }
}
EOF

ln -sf "$NGINX_CONF" "/etc/nginx/sites-enabled/$DOMAIN"

if nginx -t 2>&1; then
  ok "nginx -t прошёл, делаю reload"
  systemctl reload nginx
else
  err "nginx -t упал — конфиг отключаю, чтобы текущая CRM не пострадала"
  rm -f "/etc/nginx/sites-enabled/$DOMAIN"
  exit 1
fi

# ── Step 8: certbot ───────────────────────────────────────────────────────
step "Step 8 — SSL (Let's Encrypt)"
if ! command -v certbot >/dev/null; then
  warn "certbot не установлен — ставлю"
  apt-get update -qq
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq certbot python3-certbot-nginx
fi

certbot --nginx \
  -d "$DOMAIN" \
  --non-interactive \
  --agree-tos \
  -m "$EMAIL" \
  --redirect \
  --no-eff-email
ok "сертификат получен и применён"

# ── Step 9: smoke test + webhook ──────────────────────────────────────────
step "Step 9 — Smoke test"
sleep 2
HTTP_CODE=$(curl -sk -o /dev/null -w "%{http_code}" "https://$DOMAIN")
if [[ "$HTTP_CODE" =~ ^(200|302|307)$ ]]; then
  ok "https://$DOMAIN отвечает (HTTP $HTTP_CODE)"
else
  warn "https://$DOMAIN вернул $HTTP_CODE — проверьте pm2 logs $PM2_NAME"
fi

step "Step 10 — Регистрация Telegram webhook"
WEBHOOK_URL="https://$DOMAIN/api/messenger/telegram/webhook"
RESP=$(curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -H "content-type: application/json" \
  -d "{\"url\":\"$WEBHOOK_URL\",\"allowed_updates\":[\"message\",\"callback_query\"],\"drop_pending_updates\":true}")
if echo "$RESP" | grep -q '"ok":true'; then
  ok "webhook → $WEBHOOK_URL"
else
  warn "Telegram вернул: $RESP"
  warn "Зарегистрируйте webhook вручную через /crm/settings/bot"
fi

# ── Финал ─────────────────────────────────────────────────────────────────
echo
echo "═══════════════════════════════════════════════════════════════"
ok "Готово! Сайт: https://$DOMAIN"
echo
echo "  CRM:    https://$DOMAIN/crm/login"
echo "  Login:  admin@example.ru"
echo "  Pass:   admin123  ⚠  поменяйте на проде"
echo
echo "  Логи:        pm2 logs $PM2_NAME"
echo "  Статус:      pm2 list"
echo "  Перезапуск:  pm2 restart $PM2_NAME"
echo "  Обновить:    sudo bash $APP_DIR/deploy/update.sh"
echo
echo "Текущая CRM ($EXISTING_CRM_DIR на порту $EXISTING_CRM_PORT) не затронута."
echo "═══════════════════════════════════════════════════════════════"
