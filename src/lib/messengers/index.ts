import type { MessengerProvider, MessengerAdapter, IncomingEvent } from "./types";
import { createMaxAdapter } from "./max";
import { createTelegramAdapter } from "./telegram";
import { prisma } from "../db";
import { normalizePhone } from "../utils";

const adapters: Record<MessengerProvider, MessengerAdapter | undefined> = {
  MAX: createMaxAdapter(),
  TELEGRAM: createTelegramAdapter(),
  WEB: undefined,
  PHONE: undefined,
};

export function isMessengerProvider(provider: string): provider is MessengerProvider {
  return provider in adapters;
}

export function getAdapter(provider: string): MessengerAdapter | undefined {
  if (!isMessengerProvider(provider)) return undefined;
  return adapters[provider];
}

export function getEnabledAdapters(): MessengerAdapter[] {
  return Object.values(adapters).filter((a): a is MessengerAdapter => !!a && a.enabled);
}

/**
 * Универсальная обработка входящего сообщения от любого мессенджера.
 * Находит/создаёт клиента, сохраняет сообщение, при необходимости заводит заявку.
 */
export async function handleIncoming(event: IncomingEvent) {
  // 1. Найти связку (provider, externalId) → клиент
  let channel = await prisma.clientChannel.findUnique({
    where: {
      provider_externalId: { provider: event.provider, externalId: event.externalId },
    },
    include: { client: true },
  });

  let client = channel?.client;

  // 2. Если связки нет — создать клиента-заглушку
  if (!client) {
    const fakePhone = `unknown-${event.provider}-${event.externalId}`;
    client = await prisma.client.create({
      data: {
        name: event.displayName || `${event.provider} user`,
        phone: fakePhone,
        notes: `Создан автоматически из ${event.provider}. Уточнить телефон.`,
      },
    });
    await prisma.clientChannel.create({
      data: { clientId: client.id, provider: event.provider, externalId: event.externalId },
    });
  }

  // 3. Сохранить сообщение
  if (event.text) {
    await prisma.message.create({
      data: {
        clientId: client.id,
        provider: event.provider,
        direction: "in",
        text: event.text,
        meta: JSON.stringify(event.raw),
      },
    });
  }

  // 4. Если у клиента нет активной заявки — создать новую со статусом NEW
  const openRequest = await prisma.request.findFirst({
    where: { clientId: client.id, status: { in: ["NEW", "SCHEDULED", "IN_PROGRESS"] } },
    orderBy: { createdAt: "desc" },
  });

  if (!openRequest) {
    const last = await prisma.request.findFirst({ orderBy: { number: "desc" }, select: { number: true } });
    await prisma.request.create({
      data: {
        number: (last?.number ?? 0) + 1,
        clientId: client.id,
        source: event.provider,
        status: "NEW",
        comment: event.text,
      },
    });
  }

  return client;
}

export async function sendToClient(clientId: string, text: string) {
  const channels = await prisma.clientChannel.findMany({ where: { clientId } });
  for (const ch of channels) {
    const adapter = getAdapter(ch.provider);
    if (!adapter?.enabled) continue;
    try {
      await adapter.sendMessage(ch.externalId, text);
      await prisma.message.create({
        data: { clientId, provider: ch.provider, direction: "out", text },
      });
      return ch.provider;
    } catch (e) {
      console.error("sendToClient failed", e);
    }
  }
  return null;
}

export { normalizePhone };
