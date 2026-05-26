#!/usr/bin/env bash
# Деплой на VPS. Запускать из корня проекта на сервере:
#   ./scripts/deploy.sh
# или одной строкой по SSH:
#   ssh root@service.kopik-system.online "cd /var/www/printer-service && ./scripts/deploy.sh"
#
# Идемпотентно: можно запускать сколько угодно раз.
# Каждый шаг говорит, что он делает, и валит деплой при первой ошибке.

set -euo pipefail

cd "$(dirname "$0")/.."

echo "▸ git pull"
git pull --ff-only

echo "▸ npm install"
npm install --no-audit --no-fund

echo "▸ prisma generate"
npx prisma generate

echo "▸ prisma db push (применить изменения схемы)"
npx prisma db push --skip-generate

# Опциональный seed: запускается только если задан DEPLOY_SEED=1
if [ "${DEPLOY_SEED:-0}" = "1" ]; then
  echo "▸ db:seed"
  npm run db:seed
fi

echo "▸ build (с автоматическим postbuild → копирование static/public в standalone)"
rm -rf .next
npm run build

echo "▸ pm2 restart"
pm2 restart printer-service --update-env
pm2 save

echo "✓ deploy ok"
