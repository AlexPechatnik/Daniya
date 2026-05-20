# PrintCare — сайт + CRM (СПб)

Выездной сервис принтеров: публичный сайт + CRM для ведения заявок. Stack: **Next.js 15 + TypeScript + Tailwind + Prisma (PostgreSQL)**.

## Запуск

```bash
npm install
cp .env.example .env       # пропишите DATABASE_URL и SESSION_PASSWORD (32+ символов)
npm run db:push            # создать таблицы
npm run db:seed            # услуги, картриджи, цены, тестовые пользователи
npm run dev                # http://localhost:3000
```

Не установлен Postgres локально? Самый быстрый вариант — `docker run -d --name pg -e POSTGRES_PASSWORD=pass -p 5432:5432 postgres:16` и поставить `DATABASE_URL="postgresql://postgres:pass@localhost:5432/postgres"`.

## Доступ в CRM

- `http://localhost:3000/crm/login`
- Админ: `admin@example.ru` / `admin123`
- Мастер: `master@example.ru` / `master123`

## Структура

- `/` — главная (hero + калькулятор + форма заявки)
- `/services/{zapravka|zamena|diagnostika|remont}` — услуги
- `/problems/{polosy|bledno|ne-vidit-kartridzh|zhuet-bumagu}` — SEO-страницы под типовые проблемы
- `/corporate`, `/price`, `/about`
- `/crm` — дашборд, `/crm/calendar` — недельный календарь с drag-n-drop, `/crm/requests`, `/crm/clients`, `/crm/price` (импорт Excel)

## Быстрое создание заявки (когда клиент позвонил)

В шапке CRM кнопка **«Новая заявка»** или хоткей **Ctrl + K**. Введите телефон → если клиент есть в базе, подтянутся адреса; если нет — впишите имя и адрес, заявка создастся вместе с клиентом. 20 секунд от звонка.

## Импорт прайса

`/crm/price` → загрузка `.xlsx`. Колонки: `Услуга` (slug: `zapravka` / `zamena` / `diagnostika` / `remont`), `Бренд`, `Модель`, `Цена` (₽), `Заметка` (опц.).

## Мессенджеры (Max + Telegram)

Архитектура построена через единый адаптер `MessengerAdapter` (`src/lib/messengers/`). Адаптеры запускаются автоматически, если в `.env` указан токен — иначе живут как заглушки.

- Webhook URL для входящих: `POST /api/messenger/{max|telegram}/webhook`
- Каждое входящее сообщение автоматически: находит/создаёт клиента, сохраняется в БД, при отсутствии открытой заявки создаётся новая со статусом `NEW`.
- Когда появится **Max Bot API** — открыть `src/lib/messengers/max.ts`, заменить URL/payload на реальные (TODO-комментарии стоят), задать `MAX_BOT_TOKEN` в `.env`. Снаружи код не меняется.
- **Telegram** уже готов: получить токен у `@BotFather`, прописать `TELEGRAM_BOT_TOKEN`, зарегистрировать webhook:
  ```
  curl -F "url=https://your.site/api/messenger/telegram/webhook" \
       https://api.telegram.org/bot<TOKEN>/setWebhook
  ```

## Что есть в MVP

- ✅ Публичный сайт с парallax-фоном, мягкими анимациями (Framer Motion)
- ✅ Калькулятор с поиском по модели картриджа/принтера, фильтром по бренду, сортировкой, бейджами «Популярный / Оригинал / Совместимый»
- ✅ Форма заявки → CRM (по существующему клиенту создаёт заявку, по новому — лид)
- ✅ 4 страницы услуг + 4 SEO-страницы под проблемы (шаблонизированы)
- ✅ Прайс с импортом из Excel
- ✅ CRM: дашборд, список заявок с фильтрами, карточка с редактированием, календарь с drag-n-drop по мастерам и дням
- ✅ Быстрое добавление заявки (Ctrl+K) с поиском клиента по телефону
- ✅ Роли ADMIN / MASTER, авторизация через iron-session
- ✅ Готовые адаптеры мессенджеров (Telegram активный, Max — заглушка с точкой замены)

## Что добавим следующими итерациями

1. Личный кабинет клиента (регистрация по СМС-коду, история, повторная заявка)
2. Умные напоминания (cron: средний интервал между заправками ± 15%)
3. Документы и акты (PDF)
4. Аналитика повторных обращений
5. Бонусы / реферальная программа
6. Учёт расходников (тонер, чипы)
7. Остальные SEO-страницы по запросам

## База данных

PostgreSQL через Prisma. Главные модели: `User`, `Client`, `Address`, `Printer`, `Cartridge`, `Service`, `Price`, `Request`, `Message`, `ClientChannel`, `RequestLead`. Полная схема — `prisma/schema.prisma`.

## Тех. примечания

- Auth: `iron-session` (cookie-based). Защита `/crm/*` — `src/middleware.ts`.
- Анимации: Framer Motion + CSS parallax (без тяжёлого WebGL).
- Адаптивность: Tailwind, ломается на md/lg breakpoints. На мобиле сайдбар CRM пока скрыт — в следующей итерации добавлю drawer.

## Заглушенные TODO

- `src/lib/messengers/max.ts` — заменить endpoint/payload после публикации Max Bot API.
- Шаблон страницы услуги/проблемы можно вынести в CMS, когда страниц станет 30+.
