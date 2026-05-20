import type { MessengerAdapter, IncomingEvent, MessengerProvider } from "./types";

/**
 * Заглушка для провайдера, у которого ещё нет реального API/токена.
 * Логирует попытки отправки в консоль, не падает.
 */
export function createStub(provider: MessengerProvider): MessengerAdapter {
  return {
    provider,
    enabled: false,
    async sendMessage(externalId, text) {
      console.log(`[${provider}:stub] would send to ${externalId}: ${text}`);
    },
    async parseWebhook(): Promise<IncomingEvent | null> {
      return null;
    },
  };
}
