import { prisma } from "../db";
import type { IncomingEvent, MessengerProvider, SendOptions } from "../messengers/types";
import { getAdapter } from "../messengers";
import { handleStart, handleMessage, handleCallback } from "./flows";

export interface BotContext {
  provider: MessengerProvider;
  chatId: string;
  text?: string;
  callbackData?: string;
  contact?: IncomingEvent["contact"];
  username?: string;
  displayName?: string;
  /** Привязанный сотрудник, если есть */
  user: Awaited<ReturnType<typeof prisma.user.findUnique>> | null;
  /** Привязанный клиент, если есть */
  client: Awaited<ReturnType<typeof prisma.client.findUnique>> | null;
  /** Текущее состояние диалога */
  state: { flow: string | null; step: string | null; data: any } | null;
  send: (text: string, options?: SendOptions) => Promise<void>;
  setState: (flow: string | null, step: string | null, data?: any) => Promise<void>;
  clearState: () => Promise<void>;
  answerCallback: (text?: string) => Promise<void>;
}

/**
 * Главный диспетчер: принимает входящее событие → строит контекст → выбирает обработчик.
 */
export async function dispatch(event: IncomingEvent) {
  const adapter = getAdapter(event.provider);
  if (!adapter) return;

  // 1. Контекст: ищем сотрудника / клиента / состояние
  const [user, channel, state] = await Promise.all([
    event.provider === "TELEGRAM"
      ? prisma.user.findUnique({ where: { telegramId: event.externalId } })
      : event.provider === "MAX"
        ? prisma.user.findUnique({ where: { maxId: event.externalId } })
        : null,
    prisma.clientChannel.findUnique({
      where: { provider_externalId: { provider: event.provider, externalId: event.externalId } },
      include: { client: true },
    }),
    prisma.conversationState.findUnique({
      where: { provider_externalId: { provider: event.provider, externalId: event.externalId } },
    }),
  ]);

  const client = channel?.client ?? null;

  const ctx: BotContext = {
    provider: event.provider,
    chatId: event.externalId,
    text: event.text,
    callbackData: event.callbackData,
    contact: event.contact,
    username: event.username,
    displayName: event.displayName,
    user,
    client,
    state: state ? { flow: state.flow, step: state.step, data: state.data ? JSON.parse(state.data) : {} } : null,
    async send(text, options) {
      try {
        await adapter.sendMessage(event.externalId, text, options);
        // Сохраняем исходящее сообщение в историю (если есть клиент)
        if (client) {
          await prisma.message.create({
            data: { clientId: client.id, provider: event.provider, direction: "out", text },
          });
        }
      } catch (e) {
        console.error("send failed", e);
      }
    },
    async setState(flow, step, data = {}) {
      await prisma.conversationState.upsert({
        where: { provider_externalId: { provider: event.provider, externalId: event.externalId } },
        create: { provider: event.provider, externalId: event.externalId, flow, step, data: JSON.stringify(data) },
        update: { flow, step, data: JSON.stringify(data) },
      });
    },
    async clearState() {
      await prisma.conversationState
        .delete({ where: { provider_externalId: { provider: event.provider, externalId: event.externalId } } })
        .catch(() => {});
    },
    async answerCallback(text) {
      if (event.callbackQueryId && adapter.answerCallback) {
        await adapter.answerCallback(event.callbackQueryId, text);
      }
    },
  };

  // 2. Логирование входящего (если клиент есть)
  if (client && event.text) {
    await prisma.message.create({
      data: { clientId: client.id, provider: event.provider, direction: "in", text: event.text },
    });
  }

  // 3. Маршрутизация
  await ctx.answerCallback();
  try {
    if (event.callbackData) {
      await handleCallback(ctx);
    } else if (event.text?.startsWith("/")) {
      await handleStart(ctx);
    } else {
      await handleMessage(ctx);
    }
  } catch (e) {
    console.error("[bot] flow error:", e);
    await ctx.send("Что-то пошло не так. Попробуйте ещё раз: /start");
  }
}
