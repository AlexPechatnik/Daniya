export type MessengerProvider = "MAX" | "TELEGRAM" | "WEB" | "PHONE";

export interface KeyboardButton {
  /** Видимая надпись */
  text: string;
  /** Payload, который придёт в callback при нажатии. Для inline-кнопок. */
  callbackData?: string;
  /** Запросить контакт (Telegram) — кнопка покажется как клавиатура снизу. */
  requestContact?: boolean;
  /** URL для кнопки-ссылки */
  url?: string;
}

export interface SendOptions {
  /** Inline-кнопки в сообщении: массив строк, каждая строка — массив кнопок. */
  inlineKeyboard?: KeyboardButton[][];
  /** Reply-клавиатура (под полем ввода). Используется для request_contact и быстрых меню. */
  replyKeyboard?: KeyboardButton[][];
  /** Убрать reply-клавиатуру. */
  removeKeyboard?: boolean;
  /** HTML или Markdown. */
  parseMode?: "HTML" | "MarkdownV2";
  /** Отключить превью ссылок. */
  disablePreview?: boolean;
}

export interface IncomingEvent {
  provider: MessengerProvider;
  externalId: string;          // chat_id (число в строке) в Telegram, user_id в Max
  username?: string;
  displayName?: string;
  text?: string;
  callbackData?: string;       // Если пользователь нажал inline-кнопку
  callbackQueryId?: string;    // Для ответа answerCallbackQuery
  contact?: { phone: string; firstName?: string; lastName?: string };
  messageId?: number;
  receivedAt: Date;
  raw: unknown;
}

export interface MessengerAdapter {
  provider: MessengerProvider;
  enabled: boolean;
  /** Отправить сообщение. */
  sendMessage(externalId: string, text: string, options?: SendOptions): Promise<void>;
  /** Отредактировать ранее отправленное (после нажатия inline-кнопки). */
  editMessage?(externalId: string, messageId: number, text: string, options?: SendOptions): Promise<void>;
  /** Ответить на callback_query (убирает крутилку у клиента). */
  answerCallback?(callbackId: string, text?: string): Promise<void>;
  /** Разбор webhook'а. */
  parseWebhook(body: unknown, headers: Headers): Promise<IncomingEvent | null>;
  /** Установка webhook (вызывается админом из настроек CRM). */
  setWebhook?(url: string, secret?: string): Promise<{ ok: boolean; description?: string }>;
  /** Информация о боте. */
  getMe?(): Promise<{ id: number; username?: string; firstName?: string } | null>;
}
