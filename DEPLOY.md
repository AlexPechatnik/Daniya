# Деплой PrintCare на VPS с уже работающей CRM

Цель: поднять этот проект **изолированно** от существующего сервиса, на отдельном поддомене, в отдельных Docker-контейнерах. Текущая CRM не затрагивается.

---

## Что получится

```
        ┌─────────────────────────────────────────────────────────┐
        │                       Ваш VPS                           │
        │                                                         │
        │  ┌───────────┐                                          │
        │  │  nginx    │ ◀── 80/443                               │
        │  └─────┬─────┘                                          │
        │        │                                                │
        │        ├─ existing.com   ──▶ ваша текущая CRM           │
        │        └─ printcare.com  ──▶ 127.0.0.1:3010 (этот проект)│
        │                                  │                      │
        │  ┌──────────────────────────────────────────┐            │
        │  │  docker-compose (изолированная сеть)     │            │
        │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐  │            │
        │  │  │   web    │ │    db    │ │   bot    │  │            │
        │  │  │ :3010    │ │ postgres │ │ polling  │  │            │
        │  │  └──────────┘ └──────────┘ └──────────┘  │            │
        │  └──────────────────────────────────────────┘            │
        └─────────────────────────────────────────────────────────┘
```

Текущая CRM продолжает работать как есть. Новый проект слушает только `127.0.0.1:3010`, наружу его пускает nginx через поддомен.

---

## Что понадобится

- VPS с Linux (Ubuntu/Debian)
- Docker + Docker Compose v2 (если нет: `curl -fsSL https://get.docker.com | sh`)
- nginx (скорее всего уже есть, если работает другая CRM)
- Поддомен и доступ к DNS вашего домена

---

## 1. DNS

В кабинете регистратора домена создайте A-запись:

```
printcare.example.com   A   <IP вашего VPS>
```

Подождите 5–30 минут, пока разойдётся (`dig printcare.example.com` должен показать ваш IP).

---

## 2. Залить проект на VPS

```bash
ssh root@your-vps
cd /opt          # или куда удобно
git clone https://github.com/AlexPechatnik/Daniya.git printcare
cd printcare
```

---

## 3. Настроить переменные окружения

```bash
cp .env.production.example .env.production
nano .env.production
```

Минимум что нужно поменять:

```bash
SESSION_PASSWORD="..."          # openssl rand -hex 48
PUBLIC_BASE_URL="https://printcare.example.com"
TELEGRAM_BOT_TOKEN="..."        # токен @BotFather
POSTGRES_PASSWORD="..."         # любой пароль для постгреса в контейнере
NEXT_PUBLIC_TELEGRAM_BOT_USERNAME="ваш_бот"   # без @
```

Telegram admin chat id (`TELEGRAM_ADMIN_CHAT_ID`) можно дописать позже — после пары через `/start PAIR-...`.

---

## 4. Запустить контейнеры

```bash
docker compose --env-file .env.production build
docker compose --env-file .env.production up -d
docker compose logs -f web   # посмотреть, что взлетело
```

Проверка — должно ответить HTML:

```bash
curl -I http://127.0.0.1:3010
```

---

## 5. Поддомен через nginx

```bash
sudo cp deploy/nginx-printcare.conf /etc/nginx/sites-available/printcare.conf
sudo nano /etc/nginx/sites-available/printcare.conf
# заменить printcare.example.com на ваш реальный поддомен

sudo ln -s /etc/nginx/sites-available/printcare.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 6. HTTPS через Let's Encrypt

```bash
sudo apt install -y certbot python3-certbot-nginx   # если ещё не стоит
sudo certbot --nginx -d printcare.example.com
```

Certbot сам отредактирует `printcare.conf`, добавит `ssl_certificate` и редирект 80→443. Сертификат продлевается автоматически.

---

## 7. Первый вход и бот

1. Откройте `https://printcare.example.com/crm/login`
2. Войдите: `admin@example.ru` / `admin123` (если seed выполнялся; иначе создайте через Prisma Studio внутри контейнера: `docker compose exec web npx prisma studio`)
3. **Сразу поменяйте пароль администратора** (через Prisma Studio или коротким SQL)
4. Зайдите в `/crm/settings/bot`
5. Нажмите «Зарегистрировать webhook» — `PUBLIC_BASE_URL` уже подставится из env
6. В Telegram напишите боту `/start` → если вы первый зарегистрированный админ, привяжите свой chat_id через кнопку «🔗 Привязать через бот» в той же странице настроек

После этого бот шлёт админу уведомления о новых заявках и работает в проде.

---

## Полезные команды

```bash
# Логи
docker compose logs -f web
docker compose logs -f bot
docker compose logs -f db

# Перезапуск только web после обновления кода
git pull
docker compose --env-file .env.production build web
docker compose --env-file .env.production up -d web

# Доступ к БД
docker compose exec db psql -U printcare printcare

# Prisma Studio внутри контейнера (только когда нужно — открывайте через SSH-туннель)
docker compose exec web npx prisma studio
# затем на своей машине: ssh -L 5555:127.0.0.1:5555 root@your-vps
# открыть http://localhost:5555

# Бэкап БД
docker compose exec -T db pg_dump -U printcare printcare | gzip > backup-$(date +%F).sql.gz

# Восстановление
gunzip -c backup-2026-05-21.sql.gz | docker compose exec -T db psql -U printcare printcare
```

---

## Бот: webhook vs polling

В `docker-compose.yml` запускается **отдельный контейнер `bot`** в режиме polling. Это хорошо для теста — работает без публичного URL и без webhook.

Когда выкатите в полноценный прод и хотите webhook:

1. В `docker-compose.yml` закомментируйте сервис `bot`
2. В CRM `/crm/settings/bot` нажмите «Зарегистрировать webhook» — Telegram будет слать обновления на `https://printcare.example.com/api/messenger/telegram/webhook`
3. `docker compose up -d --remove-orphans` чтобы убрать остановленный bot-контейнер

Оба режима совместимы — нельзя только использовать **одновременно** webhook и polling на одном токене (Telegram запретит).

---

## Если вообще не хочется Postgres

Можно SQLite — изменения в двух местах:

1. В `prisma/schema.prisma`:
   ```prisma
   datasource db { provider = "sqlite" url = env("DATABASE_URL") }
   ```
2. В `.env.production`:
   ```bash
   DATABASE_URL="file:/app/data/prod.db"
   ```
3. В `docker-compose.yml` закомментируйте сервис `db` и блок `depends_on: - db`

База будет жить в volume `printcare-data` — её бэкапить через `docker cp printcare-web:/app/data/prod.db ./backup.db`.

---

## Изоляция: что точно не пересечётся со существующей CRM

- **Порты:** наружу не выставлены вообще, web слушает только `127.0.0.1:3010`
- **Сеть Docker:** свой `bridge` (`printcare`) — не видит других контейнеров на VPS
- **БД:** свой Postgres в контейнере с уникальным именем `printcare-db` и volume `printcare-pg` — никаких конфликтов
- **Volume для файлов:** `printcare-data` отдельно от других проектов
- **nginx:** отдельный config-файл `printcare.conf` — текущие конфиги не редактируются

Чтобы снести всё и перенакатить заново:

```bash
docker compose down -v   # -v удалит volume'ы вместе с БД
docker compose --env-file .env.production build --no-cache
docker compose --env-file .env.production up -d
```

Текущая CRM это не затронет вообще.
