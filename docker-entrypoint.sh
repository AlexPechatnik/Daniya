#!/bin/sh
set -e

echo "→ Применяю Prisma-схему к БД..."
npx prisma db push --skip-generate --accept-data-loss || {
  echo "✖ prisma db push упал — проверьте DATABASE_URL"
  exit 1
}

# Seed только если БД пустая (первый запуск)
if [ -n "$RUN_SEED_IF_EMPTY" ]; then
  echo "→ Проверяю, нужно ли наполнить начальными данными..."
  USERS=$(npx prisma db execute --stdin <<EOF 2>/dev/null | tail -1 || echo "?"
SELECT COUNT(*) FROM "User";
EOF
)
  if [ "$USERS" = "0" ] || [ "$USERS" = "?" ]; then
    echo "→ База пустая — выполняю seed..."
    npx tsx prisma/seed.ts || echo "⚠  seed упал, продолжаю запуск"
  fi
fi

echo "→ Запускаю Next.js..."
exec node server.js
