/**
 * Локальный режим работы бота без публичного HTTPS-адреса.
 *
 * Запускается отдельно от dev-сервера:
 *   npm run bot:poll
 *
 * Скрипт:
 *  1. Снимает webhook (Telegram не разрешает одновременно webhook + polling).
 *  2. Долго опрашивает getUpdates (long polling, timeout 25 сек).
 *  3. Каждое сообщение пропускает через тот же dispatcher, что и webhook —
 *     поведение бота идентично боевому.
 *
 * Когда захотите вернуться на webhook: остановите этот скрипт и
 *   нажмите «Зарегистрировать webhook» на /crm/settings/bot.
 */
// .env подгружается флагом --env-file=.env в команде npm run bot:poll
import { getAdapter } from "../src/lib/messengers";
import { dispatch } from "../src/lib/bot/runner";

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error("✖ TELEGRAM_BOT_TOKEN не задан в .env");
  process.exit(1);
}

const api = (method: string) => `https://api.telegram.org/bot${token}/${method}`;
const parseHeaders = new Headers();
if (process.env.TELEGRAM_WEBHOOK_SECRET) {
  parseHeaders.set("x-telegram-bot-api-secret-token", process.env.TELEGRAM_WEBHOOK_SECRET);
}

async function tg(method: string, body?: any) {
  const res = await fetch(api(method), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

async function main() {
  const adapter = getAdapter("TELEGRAM");
  if (!adapter?.enabled) {
    console.error("✖ Telegram-адаптер не активирован (нет токена)");
    process.exit(1);
  }

  // 1. Снимаем webhook, если был зарегистрирован
  await tg("deleteWebhook", { drop_pending_updates: false });

  // 2. Кто я?
  const me = await tg("getMe");
  if (!me?.ok) {
    console.error("✖ Не удалось получить инфо о боте:", me);
    process.exit(1);
  }
  console.log(`✓ Polling bot @${me.result.username} (id ${me.result.id})`);
  console.log("  Слушаю сообщения. Ctrl+C для остановки.\n");

  let offset = 0;
  let running = true;
  let errorCount = 0;

  process.on("SIGINT", () => {
    console.log("\n— останавливаюсь…");
    running = false;
  });

  while (running) {
    try {
      const updates = await tg("getUpdates", {
        offset,
        timeout: 25,
        allowed_updates: ["message", "callback_query"],
      });
      if (!updates.ok) {
        console.error("getUpdates error:", updates);
        await new Promise((r) => setTimeout(r, 3000));
        continue;
      }
      errorCount = 0;
      for (const upd of updates.result || []) {
        offset = upd.update_id + 1;
        try {
          const event = await adapter.parseWebhook(upd, parseHeaders);
          if (event) {
            const label = event.text || event.callbackData || "(контакт)";
            console.log(`← ${event.externalId}: ${label}`);
            await dispatch(event);
          }
        } catch (e) {
          console.error("[dispatch]", e);
        }
      }
    } catch (e) {
      errorCount++;
      console.error("[poll]", e);
      // Backoff при сетевых ошибках
      await new Promise((r) => setTimeout(r, Math.min(30_000, 1000 * Math.pow(2, errorCount))));
    }
  }

  console.log("Готово.");
  process.exit(0);
}

main();
