import { prisma } from "../db";
import { getAdapter } from "../messengers";
import { company } from "../company";

const CLIENT_TEMPLATES: Record<string, (req: any) => string> = {
  ACCEPTED: (r) =>
    `✅ Мастер принял вашу заявку <b>#${r.number}</b>. Когда он выедет, мы сообщим отдельно.`,
  SCHEDULED: (r) =>
    `📅 Ваша заявка <b>#${r.number}</b> запланирована${r.scheduledAt ? ` на ${formatDate(r.scheduledAt)}` : ""}.\nМастер приедет в назначенное время.`,
  EN_ROUTE: (r) =>
    `🚗 Мастер выехал к вам по заявке <b>#${r.number}</b>. Будет в течение часа.\n\nСвязь: ${company.phone}`,
  ON_SITE: (r) =>
    `📍 Мастер прибыл по заявке <b>#${r.number}</b>.`,
  IN_PROGRESS: (r) =>
    `🛠 Мастер прибыл и приступил к работе по заявке <b>#${r.number}</b>.`,
  AWAITING_PAYMENT: (r) =>
    `✅ Работа по заявке <b>#${r.number}</b> завершена. Ожидаем оплату${r.price ? ` — ${Math.round(r.price / 100)} ₽` : ""}.\n\nСпасибо, что выбрали ${company.name}!`,
  DONE: (r) =>
    `💰 Заявка <b>#${r.number}</b> закрыта. Спасибо!\n\nЕсли остались вопросы — пишите сюда, мы всегда на связи.\nНовая заявка — /start`,
  CANCELLED: (r) =>
    `Заявка <b>#${r.number}</b> отменена. Если это ошибка — напишите нам или создайте новую через /start.`,
};

/**
 * Шлёт клиенту уведомление о смене статуса по всем привязанным каналам.
 * Тихо проглатывает ошибки, чтобы не валить транзакции CRM.
 */
export async function notifyClientStatusChange(requestId: string, newStatus: string) {
  const r = await prisma.request.findUnique({
    where: { id: requestId },
    include: { client: { include: { channels: true } } },
  });
  if (!r) return;

  const template = CLIENT_TEMPLATES[newStatus];
  if (!template) return;
  const text = template(r);

  for (const channel of r.client.channels) {
    const adapter = getAdapter(channel.provider);
    if (!adapter?.enabled) continue;
    try {
      await adapter.sendMessage(channel.externalId, text);
      await prisma.message.create({
        data: { clientId: r.client.id, requestId: r.id, provider: channel.provider, direction: "out", text },
      });
    } catch (e) {
      console.error(`[notify] ${channel.provider}:${channel.externalId} failed`, e);
    }
  }
}

export async function notifyAdminsNewRequest(requestId: string) {
  const request = await prisma.request.findUnique({
    where: { id: requestId },
    include: { client: true, service: true, address: true, assignedTo: true },
  });
  if (!request) return;

  const text = [
    `Новая заявка #${request.number}`,
    `Клиент: ${request.client.name}`,
    `Телефон: ${request.client.phone}`,
    `Услуга: ${request.service?.name || "не указана"}`,
    request.printerInfo ? `Техника: ${request.printerInfo}` : null,
    request.address ? `Адрес: ${request.address.address}` : null,
    request.scheduledAt ? `Когда: ${formatDate(request.scheduledAt)}` : "Когда: не назначено",
    request.assignedTo ? `Мастер: ${request.assignedTo.name}` : null,
    request.comment ? `Комментарий: ${request.comment}` : null,
    requestUrl(request.id) ? `CRM: ${requestUrl(request.id)}` : null,
  ].filter(Boolean).join("\n");

  // Если заявка не назначена — даём кнопку «Принять на себя».
  // Мастер видит её в своём чате; нажатие меняет assignedToId на нажавшего.
  const keyboard = !request.assignedToId
    ? [[{ text: "🙋 Принять на себя", callbackData: `req:${request.id}:claim` }]]
    : undefined;

  await notifyAdminRecipients(text, keyboard);
}

/**
 * Уведомление мастеру когда клиент написал что-то в чат-бот вне активной заявки.
 * Чтобы мастер мог быстро открыть диалог в CRM и ответить.
 */
export async function notifyAdminsNewMessage(clientId: string, text: string, provider: string) {
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) return;

  const base = adminBaseUrl();
  const lines = [
    `💬 Новое сообщение от клиента`,
    `${client.name} · ${client.phone}`,
    `${provider}: «${text.slice(0, 200)}${text.length > 200 ? "…" : ""}»`,
  ];
  const keyboard = base
    ? [[{ text: "💬 Открыть чат в CRM", callbackData: "noop", url: `${base}/crm/inbox?c=${clientId}` } as any]]
    : undefined;

  await notifyAdminRecipients(lines.join("\n"), keyboard);
}

export async function notifyAdminsNewLead(leadId: string) {
  const lead = await prisma.requestLead.findUnique({ where: { id: leadId } });
  if (!lead) return;

  const text = [
    "Новая заявка с сайта",
    `Клиент: ${lead.name}`,
    `Телефон: ${lead.phone}`,
    lead.serviceKind ? `Услуга: ${lead.serviceKind}` : null,
    lead.cartridge ? `Техника: ${lead.cartridge}` : null,
    lead.address ? `Адрес: ${lead.address}` : null,
    lead.comment ? `Комментарий: ${lead.comment}` : null,
    adminBaseUrl() ? `CRM: ${adminBaseUrl()}/crm` : null,
  ].filter(Boolean).join("\n");

  await notifyAdminRecipients(text);
}

async function notifyAdminRecipients(text: string, inlineKeyboard?: { text: string; callbackData: string }[][]) {
  // Все мастера и админы с привязкой к мессенджеру (мастера тоже хотят знать о новых заявках, чтобы успеть взять)
  const staff = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "MASTER"] }, active: true },
    select: { telegramId: true, maxId: true },
  });

  const recipients = [
    ...splitRecipients(process.env.TELEGRAM_ADMIN_CHAT_ID).map((externalId) => ({ provider: "TELEGRAM", externalId })),
    ...splitRecipients(process.env.MAX_ADMIN_CHAT_ID).map((externalId) => ({ provider: "MAX", externalId })),
    ...staff.flatMap((u) => [
      u.telegramId ? { provider: "TELEGRAM", externalId: u.telegramId } : null,
      u.maxId ? { provider: "MAX", externalId: u.maxId } : null,
    ]).filter((item): item is { provider: string; externalId: string } => !!item),
  ];

  const sent = new Set<string>();
  for (const recipient of recipients) {
    const key = `${recipient.provider}:${recipient.externalId}`;
    if (sent.has(key)) continue;
    sent.add(key);

    const adapter = getAdapter(recipient.provider);
    if (!adapter?.enabled) continue;
    try {
      await adapter.sendMessage(recipient.externalId, text, { disablePreview: true, inlineKeyboard });
    } catch (e) {
      console.error(`[notify-admin] ${key} failed`, e);
    }
  }
}

function splitRecipients(value?: string) {
  return (value || "")
    .split(/[,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function adminBaseUrl() {
  return (process.env.PUBLIC_BASE_URL || "").replace(/\/+$/, "");
}

function requestUrl(id: string) {
  const base = adminBaseUrl();
  return base ? `${base}/crm/requests/${id}` : "";
}

function formatDate(d: Date) {
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" }).format(d);
}
