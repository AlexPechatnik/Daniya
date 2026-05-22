import type { MessengerAdapter, IncomingEvent, SendOptions, KeyboardButton } from "./types";
import { createStub } from "./stub";

/**
 * Telegram Bot API adapter.
 *
 * Чтобы запустить:
 *   1. Получите токен у @BotFather, пропишите TELEGRAM_BOT_TOKEN в .env
 *   2. Откройте /crm/settings/bot и нажмите «Зарегистрировать webhook» (либо вручную через curl)
 */
export function createTelegramAdapter(): MessengerAdapter {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return createStub("TELEGRAM");

  const api = (method: string) => `https://api.telegram.org/bot${token}/${method}`;

  function toTelegramReplyMarkup(opt?: SendOptions) {
    if (!opt) return undefined;
    if (opt.removeKeyboard) return { remove_keyboard: true };
    if (opt.inlineKeyboard) {
      return {
        inline_keyboard: opt.inlineKeyboard.map((row) =>
          row.map((b: KeyboardButton) => {
            if (b.url) return { text: b.text, url: b.url };
            return { text: b.text, callback_data: b.callbackData ?? "" };
          })
        ),
      };
    }
    if (opt.replyKeyboard) {
      return {
        keyboard: opt.replyKeyboard.map((row) =>
          row.map((b: KeyboardButton) => ({ text: b.text, request_contact: b.requestContact || undefined }))
        ),
        resize_keyboard: true,
        // По умолчанию одноразовая (для request_contact и т.п.).
        // persistent=true оставляет клавиатуру видимой — как нижнее меню бота.
        one_time_keyboard: !opt.persistentKeyboard,
        is_persistent: opt.persistentKeyboard || undefined,
      };
    }
    return undefined;
  }

  return {
    provider: "TELEGRAM",
    enabled: true,

    async sendMessage(externalId, text, options) {
      const body: any = {
        chat_id: externalId,
        text,
        parse_mode: options?.parseMode || "HTML",
        disable_web_page_preview: options?.disablePreview ?? true,
      };
      const rm = toTelegramReplyMarkup(options);
      if (rm) body.reply_markup = rm;

      const res = await fetch(api("sendMessage"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.text();
        console.error(`[telegram] sendMessage ${res.status}:`, err);
      }
    },

    async editMessage(externalId, messageId, text, options) {
      const body: any = {
        chat_id: externalId,
        message_id: messageId,
        text,
        parse_mode: options?.parseMode || "HTML",
      };
      const rm = toTelegramReplyMarkup(options);
      if (rm) body.reply_markup = rm;
      await fetch(api("editMessageText"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    },

    async answerCallback(callbackId, text) {
      await fetch(api("answerCallbackQuery"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ callback_query_id: callbackId, text }),
      });
    },

    async parseWebhook(body, headers): Promise<IncomingEvent | null> {
      // Проверка секрета (если установлен)
      const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
      if (expectedSecret) {
        const got = headers.get("x-telegram-bot-api-secret-token");
        if (got !== expectedSecret) {
          console.warn("[telegram] webhook secret mismatch, ignoring");
          return null;
        }
      }

      const update = body as any;

      // Callback от нажатия inline-кнопки
      if (update?.callback_query) {
        const cq = update.callback_query;
        return {
          provider: "TELEGRAM",
          externalId: String(cq.message.chat.id),
          username: cq.from?.username,
          displayName: [cq.from?.first_name, cq.from?.last_name].filter(Boolean).join(" "),
          callbackData: cq.data,
          callbackQueryId: cq.id,
          messageId: cq.message.message_id,
          text: undefined,
          receivedAt: new Date(),
          raw: update,
        };
      }

      const msg = update?.message;
      if (!msg) return null;

      // Контакт (request_contact)
      let contact: IncomingEvent["contact"] | undefined;
      if (msg.contact) {
        contact = {
          phone: msg.contact.phone_number?.startsWith("+") ? msg.contact.phone_number : `+${msg.contact.phone_number}`,
          firstName: msg.contact.first_name,
          lastName: msg.contact.last_name,
        };
      }

      return {
        provider: "TELEGRAM",
        externalId: String(msg.chat.id),
        username: msg.from?.username,
        displayName: [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(" "),
        text: msg.text,
        contact,
        messageId: msg.message_id,
        receivedAt: new Date(msg.date * 1000),
        raw: update,
      };
    },

    async setWebhook(url, secret) {
      const res = await fetch(api("setWebhook"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          url,
          secret_token: secret,
          allowed_updates: ["message", "callback_query"],
          drop_pending_updates: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      return { ok: data.ok ?? false, description: data.description };
    },

    async getMe() {
      try {
        // 5-секундный таймаут — иначе зависает страница настроек при недоступном api.telegram.org
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(api("getMe"), { signal: controller.signal });
        clearTimeout(timer);
        if (!res.ok) return null;
        const data = await res.json();
        if (!data.ok) return null;
        return {
          id: data.result.id,
          username: data.result.username,
          firstName: data.result.first_name,
        };
      } catch (e: any) {
        if (e?.name !== "AbortError") console.error("[telegram] getMe network error:", e?.message || e);
        return null;
      }
    },
  };
}
