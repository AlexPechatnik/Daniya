import type { MessengerAdapter, IncomingEvent } from "./types";
import { createStub } from "./stub";

/**
 * Адаптер для мессенджера Max (VK). Реализация — заглушка до публикации
 * официального Bot API. Точки замены отмечены TODO.
 *
 * Когда появится API:
 *   1. Заменить URL в sendMessage на реальный endpoint Max Bot API.
 *   2. Указать формат payload и заголовки авторизации.
 *   3. В parseWebhook разобрать реальную структуру update.
 *
 * Снаружи код не меняется — он работает только через MessengerAdapter.
 */
export function createMaxAdapter(): MessengerAdapter {
  const token = process.env.MAX_BOT_TOKEN;
  if (!token) return createStub("MAX");

  return {
    provider: "MAX",
    enabled: true,

    async sendMessage(externalId, text) {
      // TODO: заменить на реальный endpoint Max Bot API, когда он будет опубликован
      const res = await fetch("https://api.max.ru/bot/sendMessage", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ user_id: externalId, text }),
      });
      if (!res.ok) {
        console.error(`[max] send failed: ${res.status} ${await res.text()}`);
      }
    },

    async parseWebhook(body): Promise<IncomingEvent | null> {
      // TODO: подставить реальную схему update, когда будет документация
      const update = body as any;
      const msg = update?.message ?? update;
      if (!msg?.text || !msg?.from?.id) return null;
      return {
        provider: "MAX",
        externalId: String(msg.from.id),
        username: msg.from.username,
        displayName: msg.from.name,
        text: msg.text,
        receivedAt: new Date(msg.date ? msg.date * 1000 : Date.now()),
        raw: update,
      };
    },
  };
}
