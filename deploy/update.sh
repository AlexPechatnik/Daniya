#!/usr/bin/env bash
# PrintCare — обновление существующей установки.
# Использование: sudo bash /var/www/printer-service/deploy/update.sh

set -euo pipefail

APP_DIR="/var/www/printer-service"
PM2_NAME="printer-service"

C_OK="\033[32m"; C_STEP="\033[1;36m"; C_OFF="\033[0m"
ok()   { printf "${C_OK}✓${C_OFF} %s\n" "$*"; }
step() { printf "\n${C_STEP}▸ %s${C_OFF}\n" "$*"; }

[[ $EUID -eq 0 ]] || { echo "Запустите от root"; exit 1; }
[[ -d "$APP_DIR" ]] || { echo "$APP_DIR не существует. Сначала запустите install.sh"; exit 1; }

cd "$APP_DIR"

step "Git pull"
git pull
ok "обновлено"

step "Зависимости"
npm ci --no-audit --no-fund
ok "ok"

step "Prisma"
npx prisma generate
npx prisma db push --accept-data-loss
ok "ok"

step "Build"
npm run build
# Перекладываем статику в standalone
cp -r public .next/standalone/public 2>/dev/null || true
mkdir -p .next/standalone/.next
rm -rf .next/standalone/.next/static
cp -r .next/static .next/standalone/.next/static
mkdir -p .next/standalone/node_modules
cp -r node_modules/.prisma .next/standalone/node_modules/.prisma 2>/dev/null || true
cp -r node_modules/@prisma .next/standalone/node_modules/@prisma 2>/dev/null || true
cp .env .next/standalone/.env
cp -r prisma .next/standalone/prisma 2>/dev/null || true
ok "build готов"

step "Перезапуск PM2"
pm2 restart "$PM2_NAME" --update-env
pm2 save
ok "ok"

echo
ok "Обновление завершено."
pm2 list
