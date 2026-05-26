import { prisma } from "../db";
import type { BotContext } from "./runner";
import { normalizePhone, formatRub } from "../utils";
import { company } from "../company";
import { format, addDays, setHours, setMinutes } from "date-fns";
import { ru } from "date-fns/locale";
import { notifyAdminsNewRequest, notifyAdminsNewMessage } from "./notify";
import { proposeNextSlots, formatSlotLabel } from "../scheduling";
import { enrichAddress } from "../districts";
import { shortenSpbAddress } from "../address";

// ─────────────────────────────────────────────────────────────────────────────
// Главные обработчики

export async function handleStart(ctx: BotContext) {
  const rawText = ctx.text?.trim() || "";
  const cmd = rawText.toLowerCase();

  // /start PAIR-XXXX — deep-link привязка сотрудника
  const pairMatch = rawText.match(/^\/start\s+PAIR-([A-Z0-9]+)/i);
  if (pairMatch) {
    return handlePairing(ctx, pairMatch[1]);
  }

  // Команды для всех
  if (cmd === "/start" || cmd.startsWith("/start ")) {
    await ctx.clearState();
    if (isAdmin(ctx)) return adminMenu(ctx);
    if (ctx.user) return masterMenu(ctx);
    return clientWelcome(ctx);
  }
  if (cmd === "/cancel" || cmd === "/отмена") {
    await ctx.clearState();
    return ctx.send("Отменил. Начать заново — /start");
  }

  // Команды клиента
  if (cmd === "/status" || cmd === "/мои") return clientStatus(ctx);
  if (cmd === "/help" || cmd === "/помощь") return helpMenu(ctx);

  // Команды мастера
  if (ctx.user) {
    if (isAdmin(ctx) && (cmd === "/new" || cmd === "/заявка")) return startAdminRequest(ctx);
    if (isAdmin(ctx) && (cmd === "/today" || cmd === "/сегодня")) return adminToday(ctx);
    if (cmd === "/today" || cmd === "/сегодня") return masterToday(ctx);
    if (cmd === "/next" || cmd === "/следующая") return masterNext(ctx);
  }

  return helpMenu(ctx);
}

export async function handleMessage(ctx: BotContext) {
  // Контакт (request_contact) — обрабатывается в любом состоянии
  if (ctx.contact) {
    await handleContact(ctx);
    return;
  }

  // Нажатия persistent reply-кнопок (приходят как обычный текст). Имеют приоритет над flow.
  const text = (ctx.text || "").trim();
  if (text === "🏠 Главное меню") {
    await ctx.clearState();
    if (isAdmin(ctx)) return adminMenu(ctx);
    if (ctx.user) return masterMenu(ctx);
    return clientWelcome(ctx);
  }
  if (text === "📝 Новая заявка") {
    await ctx.clearState();
    return startNewRequest(ctx);
  }
  if (text === "📋 Мои заявки") {
    return clientStatus(ctx);
  }
  if (text === "💰 Цены") {
    return clientPrices(ctx);
  }

  // Если активен flow — продолжаем его
  if (ctx.state?.flow === "new_request") {
    return continueNewRequest(ctx);
  }
  if (ctx.state?.flow === "admin_request") {
    return continueAdminRequest(ctx);
  }
  if (ctx.state?.flow === "contact_master") {
    // Сообщение для мастера — уже залогировано в runner. Подтверждаем и возвращаем в меню.
    await ctx.clearState();
    return ctx.send(
      "✅ Сообщение передано мастеру. Он ответит в этот чат.\n\nЧтобы вернуться в меню — /start",
      { inlineKeyboard: [backToMenuRow()] },
    );
  }

  if (isAdmin(ctx) && ctx.text) {
    return startAdminRequest(ctx, ctx.text);
  }

  // Свободный текст без активного flow — записываем в общий чат
  if (ctx.client && ctx.text) {
    // Уже залогировано в runner. Шлём ping мастеру в Telegram и отвечаем клиенту.
    notifyAdminsNewMessage(ctx.client.id, ctx.text, ctx.provider).catch((e) =>
      console.error("[bot] notify admin failed", e),
    );
    await ctx.send(
      "Сообщение записано — мастер увидит его в CRM и ответит.",
      { inlineKeyboard: [backToMenuRow()] },
    );
    return;
  }

  // Незнакомый клиент пишет произвольный текст — предлагаем оставить заявку
  return clientWelcome(ctx);
}

export async function handleCallback(ctx: BotContext) {
  const data = ctx.callbackData;
  if (!data) return;

  // Главное меню клиента — универсальная кнопка "Назад"
  if (data === "client:menu") {
    await ctx.clearState();
    if (isAdmin(ctx)) return adminMenu(ctx);
    if (ctx.user) return masterMenu(ctx);
    return clientWelcome(ctx);
  }
  if (data === "client:about") return clientAbout(ctx);
  if (data === "client:contact") return clientContactMaster(ctx);
  if (data === "client:prices") return clientPrices(ctx);

  if (data === "new_request") return startNewRequest(ctx);
  if (data === "admin:new") return startAdminRequest(ctx);
  if (data === "admin:confirm") return createAdminRequest(ctx);
  if (data === "admin:today") return adminToday(ctx);
  if (data === "admin:menu") {
    await ctx.clearState();
    return adminMenu(ctx);
  }
  if (data === "my_requests") return clientStatus(ctx);
  if (data === "cancel_flow") {
    await ctx.clearState();
    return ctx.send("Отменил.", { inlineKeyboard: [backToMenuRow()] });
  }

  // Шаги клиентского wizard'а
  if (data.startsWith("svc:")) return newRequestServicePicked(ctx, data.slice(4));
  if (data.startsWith("when:")) return newRequestWhenPicked(ctx, data.slice(5));

  // Корзина — выбор картриджа
  if (data === "cart:more") {
    const cur = ctx.state?.data || { items: [] };
    await ctx.setState("new_request", "cartridge_pick", cur);
    return sendCartridgePicker(ctx, cur);
  }
  if (data === "cart:view") return cartView(ctx);
  if (data === "cart:custom") return cartCustomPrompt(ctx);
  if (data === "cart:search") return cartSearchPrompt(ctx);
  if (data === "cart:checkout") return cartCheckout(ctx);
  if (data === "cart:custom_save") return cartCustomFromSearch(ctx);
  if (data.startsWith("cart:add:")) return cartAddCartridge(ctx, data.slice("cart:add:".length));
  if (data.startsWith("cart:remove:")) return cartRemoveItem(ctx, data.slice("cart:remove:".length));

  if (data.startsWith("admin:svc:")) return adminServicePicked(ctx, data.slice("admin:svc:".length));
  if (data.startsWith("admin:when:")) return adminWhenPicked(ctx, data.slice("admin:when:".length));
  if (data.startsWith("admin:edit:")) return adminEditField(ctx, data.slice("admin:edit:".length));
  if (data.startsWith("admin:skip:")) return adminSkipField(ctx, data.slice("admin:skip:".length));
  if (data.startsWith("admin:master:")) return adminMasterPicked(ctx, data.slice("admin:master:".length));

  // Мастерское меню (кнопки)
  if (data === "master:today") return masterToday(ctx);
  if (data === "master:next") return masterNext(ctx);

  // Мастерские действия по заявке (включая req:<id>:claim)
  if (data.startsWith("req:")) {
    return masterRequestAction(ctx, data.slice(4));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// КЛИЕНТ — главное меню и приветствие

const CHIP_PRICE_DEFAULT = 15000; // копейки = 150 ₽

// Унифицированная кнопка возврата — добавляется в конец inline-клавиатуры на
// большинстве экранов, чтобы клиент всегда мог вернуться в главное меню.
function backToMenuRow() {
  return [{ text: "🏠 Главное меню", callbackData: "client:menu" }];
}

/**
 * Persistent клавиатура клиента — показывается под полем ввода, не исчезает.
 * Имитирует «нижнее меню» бота: всегда быстрый доступ к ключевым действиям.
 * Тексты этих кнопок обрабатываются как команды в handleStart.
 */
function clientPersistentKeyboard() {
  return [
    [{ text: "📝 Новая заявка" }, { text: "📋 Мои заявки" }],
    [{ text: "💰 Цены" }, { text: "🏠 Главное меню" }],
  ];
}

/**
 * Цена услуги для конкретного картриджа. Если для пары (service, cartridge)
 * прайс не задан — возвращаем базовую цену услуги (Price с cartridgeId=null).
 * Это нужно, потому что детальные цены у нас есть только для заправки, а
 * замена/диагностика/ремонт идут по базовой ставке.
 */
async function priceFor(serviceId: string, cartridgeId: string): Promise<number> {
  const specific = await prisma.price.findFirst({ where: { serviceId, cartridgeId } });
  if (specific) return specific.amount;
  const base = await prisma.price.findFirst({ where: { serviceId, cartridgeId: null } });
  return base?.amount ?? 0;
}

async function clientWelcome(ctx: BotContext) {
  const name = ctx.displayName ? `, ${ctx.displayName.split(" ")[0]}` : "";
  // Подгружаем счётчик активных заявок чтобы показать в кнопке «Мои заявки (N)»
  let activeCount = 0;
  if (ctx.client) {
    activeCount = await prisma.request.count({
      where: {
        clientId: ctx.client.id,
        status: { in: ["NEW", "ACCEPTED", "SCHEDULED", "EN_ROUTE", "ON_SITE", "IN_PROGRESS", "AWAITING_PAYMENT"] },
      },
    });
  }

  await ctx.send(
    `<b>${company.name}</b> — выездной сервис принтеров в ${company.city}\n\n` +
      `Здравствуйте${name}! Чем помочь?`,
    {
      inlineKeyboard: [
        [{ text: "📝 Новая заявка", callbackData: "new_request" }],
        [{
          text: activeCount > 0 ? `📋 Мои заявки (${activeCount})` : "📋 Мои заявки",
          callbackData: "my_requests",
        }],
        [{ text: "💰 Узнать цену", callbackData: "client:prices" }],
        [{ text: "📞 Связаться с мастером", callbackData: "client:contact" }],
        [{ text: "ℹ️ О компании", callbackData: "client:about" }],
      ],
      // Persistent клавиатура под полем ввода — всегда видно главное навменю
      replyKeyboard: clientPersistentKeyboard(),
      persistentKeyboard: true,
    },
  );
}

async function helpMenu(ctx: BotContext) {
  await ctx.send(
    `Доступные команды:\n\n` +
      `/start — главное меню\n` +
      `/status — мои заявки\n` +
      `/cancel — отменить текущее действие\n\n` +
      `Телефон офиса: ${company.phone}\n` +
      `Адрес: ${company.address}`,
    { inlineKeyboard: [backToMenuRow()] },
  );
}

async function clientAbout(ctx: BotContext) {
  await ctx.send(
    `<b>${company.name}</b>\n` +
      `Выездной сервис принтеров в ${company.city}.\n\n` +
      `Работаем с 2007 года. Помогаем компаниям и частным клиентам поддерживать печатную технику в рабочем состоянии.\n\n` +
      `<b>Что делаем:</b>\n` +
      `• 💧 Заправка картриджей\n` +
      `• 🔄 Замена картриджей\n` +
      `• 🩺 Диагностика\n` +
      `• 🔧 Ремонт принтеров\n\n` +
      `<b>Контакты:</b>\n` +
      `📞 ${company.phone}\n` +
      `📍 ${company.address}\n` +
      `🕐 Пн–Пт 9:00–20:00, Сб 10:00–18:00`,
    { inlineKeyboard: [backToMenuRow()] },
  );
}

async function clientContactMaster(ctx: BotContext) {
  // Простой режим: оставляем сообщение, мастер ответит из CRM
  await ctx.setState("contact_master", "input", {});
  await ctx.send(
    `💬 Напишите сообщение мастеру — оно появится в CRM, мастер ответит в этот чат.\n\n` +
      `<i>Например: «У меня HP M125, печатает с полосами. Когда удобнее приехать?»</i>`,
    { inlineKeyboard: [backToMenuRow()] },
  );
}

async function clientPrices(ctx: BotContext) {
  // Топ-6 популярных моделей с ценой заправки
  const items = await prisma.cartridge.findMany({
    where: { isPopular: true },
    include: { prices: { where: { service: { slug: "zapravka" } }, take: 1 } },
    orderBy: [{ brand: "asc" }, { model: "asc" }],
    take: 8,
  });
  const lines = items
    .map((c) => {
      const p = c.prices[0]?.amount;
      const chip = c.hasChip ? " · с чипом" : "";
      return p ? `• <b>${c.brand} ${c.model}</b> — ${formatRub(p)}${chip}` : null;
    })
    .filter(Boolean)
    .join("\n");

  await ctx.send(
    `💰 <b>Заправка популярных моделей</b>\n\n${lines}\n\n` +
      `<i>На моделях с чипом — +150 ₽ за замену. Точная цена зависит от состояния картриджа.</i>`,
    {
      inlineKeyboard: [
        [{ text: "📝 Заказать заправку", callbackData: "new_request" }],
        backToMenuRow(),
      ],
    },
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// КЛИЕНТ — список заявок

async function clientStatus(ctx: BotContext) {
  if (!ctx.client) {
    return ctx.send(
      "У вас пока нет заявок. Создать первую?",
      { inlineKeyboard: [[{ text: "📝 Новая заявка", callbackData: "new_request" }], backToMenuRow()] },
    );
  }
  const requests = await prisma.request.findMany({
    where: { clientId: ctx.client.id },
    include: { service: true, assignedTo: true },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  if (requests.length === 0) {
    return ctx.send(
      "Заявок пока нет. Создать первую?",
      { inlineKeyboard: [[{ text: "📝 Новая заявка", callbackData: "new_request" }], backToMenuRow()] },
    );
  }
  const lines = requests.map((r) => {
    const time = r.scheduledAt ? format(r.scheduledAt, "d MMM, HH:mm", { locale: ru }) : "без даты";
    return `• <b>#${r.number}</b> · ${statusEmoji(r.status)} ${statusLabel(r.status)}\n  ${r.service?.name || "услуга"} · ${time}`;
  });
  await ctx.send(`<b>Ваши заявки:</b>\n\n${lines.join("\n\n")}`, {
    inlineKeyboard: [[{ text: "📝 Новая заявка", callbackData: "new_request" }], backToMenuRow()],
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// КЛИЕНТ — wizard новой заявки с CART (несколько картриджей)

async function startNewRequest(ctx: BotContext) {
  const services = await prisma.service.findMany({ orderBy: { name: "asc" } });
  // Сбрасываем cart при старте нового сценария
  await ctx.setState("new_request", "service", { items: [] });
  await ctx.send(
    "<b>Шаг 1 из 4</b> — какая услуга нужна?",
    {
      inlineKeyboard: [
        ...services.map((s) => [{ text: serviceEmoji(s.slug) + " " + s.name, callbackData: `svc:${s.id}` }]),
        backToMenuRow(),
      ],
    },
  );
}

async function newRequestServicePicked(ctx: BotContext, serviceId: string) {
  const service = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!service) return;
  const data = ctx.state?.data || { items: [] };
  data.serviceId = service.id;
  data.serviceName = service.name;
  data.serviceSlug = service.slug;
  data.items = data.items || [];
  await ctx.setState("new_request", "cartridge_pick", data);
  return sendCartridgePicker(ctx, data);
}

// ── ВЫБОР КАРТРИДЖА: популярные кнопки + поиск + свободный ввод ─────────────
async function sendCartridgePicker(ctx: BotContext, data: any) {
  const popular = await prisma.cartridge.findMany({
    where: { isPopular: true },
    include: { prices: { where: { service: { slug: data.serviceSlug || "zapravka" } }, take: 1 } },
    orderBy: [{ brand: "asc" }, { model: "asc" }],
    take: 8,
  });

  const cartLine = data.items?.length
    ? `\n\n🛒 В корзине: <b>${data.items.length}</b> позиц${endingMatch(data.items.length, "ия", "ии", "ий")} на ~${formatRub(cartTotal(data.items))}`
    : "";

  await ctx.send(
    `<b>Шаг 2 из 4</b> — какой картридж?\n\n🔥 Популярные модели:` + cartLine,
    {
      inlineKeyboard: [
        ...popular.map((c) => {
          const price = c.prices[0]?.amount;
          const priceLabel = price ? ` · ${Math.round(price / 100)}₽` : "";
          const chipMark = c.hasChip ? " ⚡" : "";
          return [{ text: `${c.brand} ${c.model}${priceLabel}${chipMark}`, callbackData: `cart:add:${c.id}` }];
        }),
        [{ text: "🔍 Найти по модели", callbackData: "cart:search" }],
        [{ text: "✏️ Своя модель текстом", callbackData: "cart:custom" }],
        data.items?.length
          ? [{ text: "✓ Перейти к оформлению", callbackData: "cart:checkout" }]
          : null,
        backToMenuRow(),
      ].filter(Boolean) as any,
    },
  );
}

async function cartAddCartridge(ctx: BotContext, cartridgeId: string) {
  const c = await prisma.cartridge.findUnique({ where: { id: cartridgeId } });
  if (!c) return;
  const data = ctx.state?.data || { items: [] };
  // Цена для выбранной услуги. Если для этой связки нет — берём базовую цену услуги.
  const refill = data.serviceId ? await priceFor(data.serviceId, c.id) : 0;
  const chipPrice = c.hasChip ? (c.chipPrice ?? CHIP_PRICE_DEFAULT) : 0;
  data.items = data.items || [];
  data.items.push({
    cartridgeId: c.id,
    label: `${c.brand} ${c.model}`,
    price: refill,
    chipPrice,
    hasChip: c.hasChip,
    withChip: c.hasChip, // по умолчанию включаем замену чипа
    quantity: 1,
  });
  await ctx.setState("new_request", "cartridge_pick", data);

  const item = data.items[data.items.length - 1];
  const serviceName = data.serviceName || "услуга";
  await ctx.send(
    `✅ Добавлено: <b>${item.label}</b>` +
      (item.price > 0
        ? `\n• ${serviceName}: ${formatRub(item.price)}`
        : `\n• ${serviceName}: цена уточняется`) +
      (item.hasChip && item.withChip ? `\n• Замена чипа: +${formatRub(item.chipPrice)}` : "") +
      `\n\n🛒 В корзине ${data.items.length} позиц${endingMatch(data.items.length, "ия", "ии", "ий")}` +
      (cartTotal(data.items) > 0 ? `, ~${formatRub(cartTotal(data.items))}` : ""),
    {
      inlineKeyboard: [
        [{ text: "➕ Добавить ещё картридж", callbackData: "cart:more" }],
        [{ text: "✓ Оформить заявку", callbackData: "cart:checkout" }],
        [{ text: "🗑 Изменить корзину", callbackData: "cart:view" }],
        backToMenuRow(),
      ],
    },
  );
}

async function cartView(ctx: BotContext) {
  const data = ctx.state?.data || { items: [] };
  if (!data.items?.length) {
    return ctx.send("Корзина пуста.", {
      inlineKeyboard: [[{ text: "➕ Добавить картридж", callbackData: "cart:more" }], backToMenuRow()],
    });
  }
  const rows: any[] = data.items.map((it: any, i: number) => {
    const total = (it.price + (it.withChip ? it.chipPrice : 0)) * it.quantity;
    return [{ text: `🗑 ${it.label} — ${formatRub(total)}`, callbackData: `cart:remove:${i}` }];
  });
  await ctx.send(
    `🛒 <b>Корзина (нажмите чтобы убрать):</b>\n\nИтого: <b>${formatRub(cartTotal(data.items))}</b>`,
    {
      inlineKeyboard: [
        ...rows,
        [{ text: "➕ Добавить ещё", callbackData: "cart:more" }],
        [{ text: "✓ Оформить заявку", callbackData: "cart:checkout" }],
        backToMenuRow(),
      ],
    },
  );
}

async function cartRemoveItem(ctx: BotContext, indexStr: string) {
  const idx = parseInt(indexStr, 10);
  const data = ctx.state?.data || { items: [] };
  if (Number.isFinite(idx) && data.items?.[idx]) {
    data.items.splice(idx, 1);
    await ctx.setState("new_request", "cartridge_pick", data);
  }
  return cartView(ctx);
}

// Свободный ввод модели текстом
async function cartCustomPrompt(ctx: BotContext) {
  await ctx.setState("new_request", "cartridge_custom", ctx.state?.data || { items: [] });
  await ctx.send(
    `✏️ Напишите модель текстом — например: <i>HP CF283A</i> или <i>модель принтера Canon LBP6020</i>.\n\n` +
      `Точную цену скажет мастер на месте.`,
    { inlineKeyboard: [[{ text: "⬅️ К выбору картриджа", callbackData: "cart:more" }], backToMenuRow()] },
  );
}

async function cartCustomReceived(ctx: BotContext) {
  const data = ctx.state?.data || { items: [] };
  data.items = data.items || [];
  data.items.push({
    cartridgeId: null,
    label: (ctx.text || "Своя модель").trim(),
    price: 0,
    chipPrice: 0,
    hasChip: false,
    withChip: false,
    quantity: 1,
    isCustom: true,
  });
  await ctx.setState("new_request", "cartridge_pick", data);
  await ctx.send(
    `✅ Добавлено: <b>${data.items[data.items.length - 1].label}</b>\n<i>Цена уточняется мастером</i>`,
    {
      inlineKeyboard: [
        [{ text: "➕ Добавить ещё картридж", callbackData: "cart:more" }],
        [{ text: "✓ Оформить заявку", callbackData: "cart:checkout" }],
        [{ text: "🗑 Изменить корзину", callbackData: "cart:view" }],
        backToMenuRow(),
      ],
    },
  );
}

// Поиск по моделям
async function cartSearchPrompt(ctx: BotContext) {
  await ctx.setState("new_request", "cartridge_search", ctx.state?.data || { items: [] });
  await ctx.send(
    `🔍 Введите модель картриджа или принтера.\n\n<i>Например: «CF283», «LBP6020», «Samsung 111»</i>`,
    { inlineKeyboard: [[{ text: "⬅️ К выбору", callbackData: "cart:more" }], backToMenuRow()] },
  );
}

async function cartSearchReceived(ctx: BotContext) {
  const q = (ctx.text || "").trim();
  if (q.length < 2) return ctx.send("Слишком короткий запрос — нужно минимум 2 символа.");
  const data = ctx.state?.data || { items: [] };

  // 1) Прямой поиск по картриджам (бренд/модель/совместимость).
  const direct = await prisma.cartridge.findMany({
    where: {
      OR: [
        { model: { contains: q } },
        { brand: { contains: q } },
        { compatible: { contains: q } },
      ],
    },
    include: { prices: { where: { service: { slug: data.serviceSlug || "zapravka" } }, take: 1 } },
    orderBy: [{ isPopular: "desc" }, { brand: "asc" }, { model: "asc" }],
    take: 8,
  });

  // 2) Клиент написал модель принтера (например «M404») —
  // подтягиваем подходящие картриджи из каталога PrinterModel.
  const printerMatch = await prisma.printerModel.findFirst({
    where: {
      OR: [
        { family: { contains: q } },
        { aliases: { contains: q } },
        { brand: { contains: q } },
      ],
    },
    include: {
      cartridges: {
        include: {
          cartridge: {
            include: { prices: { where: { service: { slug: data.serviceSlug || "zapravka" } }, take: 1 } },
          },
        },
      },
    },
    orderBy: [{ demand: "asc" }],
  });
  const fromPrinter = printerMatch?.cartridges.map((pc) => pc.cartridge) || [];

  // Объединяем, дедуплицируем по id, ограничиваем до 10.
  const seen = new Set<string>();
  const hits = [...direct, ...fromPrinter].filter((c) => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  }).slice(0, 10);

  // Запомним, что нашёлся принтер — покажем в подписи, чтобы клиент понял
  // «это картриджи для вашей модели».
  const printerHintLine = printerMatch
    ? `\n\nПо запросу узнал принтер: <b>${printerMatch.brand} ${printerMatch.family}</b>. Вот подходящие картриджи:`
    : "";

  if (hits.length === 0) {
    return ctx.send(
      `Ничего не нашли по «${q}». Можно добавить как свободный текст — мастер уточнит на месте.`,
      {
        inlineKeyboard: [
          [{ text: `✏️ Добавить «${q.slice(0, 30)}»`, callbackData: "cart:custom_save" }],
          [{ text: "🔍 Попробовать ещё", callbackData: "cart:search" }],
          backToMenuRow(),
        ],
      },
    );
  }

  // Сохраняем запрос на случай если выберет «добавить как есть»
  data.lastSearch = q;
  await ctx.setState("new_request", "cartridge_pick", data);
  await ctx.send(
    `Нашли по «${q}» — выберите:` + printerHintLine,
    {
      inlineKeyboard: [
        ...hits.map((c) => {
          const price = c.prices[0]?.amount;
          const priceLabel = price ? ` · ${Math.round(price / 100)}₽` : "";
          const chipMark = c.hasChip ? " ⚡" : "";
          return [{ text: `${c.brand} ${c.model}${priceLabel}${chipMark}`, callbackData: `cart:add:${c.id}` }];
        }),
        [{ text: "🔍 Поиск ещё", callbackData: "cart:search" }],
        [{ text: "⬅️ Назад к популярным", callbackData: "cart:more" }],
        backToMenuRow(),
      ],
    },
  );
}

async function cartCustomFromSearch(ctx: BotContext) {
  const data = ctx.state?.data || { items: [] };
  if (!data.lastSearch) return cartCustomPrompt(ctx);
  data.items = data.items || [];
  data.items.push({
    cartridgeId: null,
    label: data.lastSearch,
    price: 0, chipPrice: 0, hasChip: false, withChip: false,
    quantity: 1, isCustom: true,
  });
  delete data.lastSearch;
  await ctx.setState("new_request", "cartridge_pick", data);
  return ctx.send(`✅ Добавлено: <b>${data.items[data.items.length - 1].label}</b>`, {
    inlineKeyboard: [
      [{ text: "➕ Добавить ещё", callbackData: "cart:more" }],
      [{ text: "✓ Оформить заявку", callbackData: "cart:checkout" }],
      backToMenuRow(),
    ],
  });
}

// Переход к выбору даты — реальные свободные слоты из календаря
async function cartCheckout(ctx: BotContext) {
  const data = ctx.state?.data || { items: [] };
  if (!data.items?.length) {
    return ctx.send("Сначала добавьте хотя бы один картридж.", {
      inlineKeyboard: [[{ text: "➕ Добавить картридж", callbackData: "cart:more" }], backToMenuRow()],
    });
  }

  // Запрашиваем 6 ближайших реально свободных слотов с учётом календаря и отсечки
  const slots = await proposeNextSlots(6);
  data.proposedSlots = slots.map((s) => s.toISOString());
  await ctx.setState("new_request", "when", data);

  const buttons: any[] = slots.map((slot, i) => [
    { text: `🕐 ${formatSlotLabel(slot)}`, callbackData: `when:slot:${i}` },
  ]);

  // Если слотов нет — fallback на «обсудим»
  if (buttons.length === 0) {
    buttons.push([{ text: "🗓 На ближайшие дни — обсудим", callbackData: "when:any" }]);
  } else {
    buttons.push([{ text: "🗓 Не подходит — обсудим", callbackData: "when:any" }]);
  }
  buttons.push([{ text: "⬅️ Назад к корзине", callbackData: "cart:view" }]);

  await ctx.send(
    `<b>Шаг 3 из 4</b> — когда вам удобно?\n\n` +
      `🛒 В заявке: ${data.items.length} позиц${endingMatch(data.items.length, "ия", "ии", "ий")}` +
      (cartTotal(data.items) > 0 ? `, ~${formatRub(cartTotal(data.items))}` : "") +
      (slots.length > 0
        ? `\n\nВот свободные окна — выберите удобное:`
        : `\n\n<i>Свободных слотов на ближайшие дни нет — обсудим с мастером.</i>`),
    { inlineKeyboard: buttons },
  );
}

async function newRequestWhenPicked(ctx: BotContext, when: string) {
  const data = ctx.state?.data || { items: [] };

  if (when === "any") {
    data.scheduledAt = null;
    data.whenChoice = "any";
  } else if (when.startsWith("slot:")) {
    const idx = parseInt(when.slice(5), 10);
    const isoList: string[] = Array.isArray(data.proposedSlots) ? data.proposedSlots : [];
    const iso = isoList[idx];
    if (iso) {
      data.scheduledAt = iso;
      data.whenChoice = "slot";
    } else {
      // Слот устарел (state потерялся) — fallback на «обсудим»
      data.scheduledAt = null;
      data.whenChoice = "any";
    }
  } else if (when === "today") {
    // Совместимость со старыми сообщениями
    data.scheduledAt = setMinutes(setHours(new Date(), 16), 0).toISOString();
  } else if (when === "tomorrow") {
    data.scheduledAt = setMinutes(setHours(addDays(new Date(), 1), 10), 0).toISOString();
  } else {
    data.scheduledAt = null;
  }

  await ctx.setState("new_request", "address", data);
  await ctx.send(
    "<b>Шаг 4 из 4</b> — куда приехать?\n\n<i>Напишите адрес: район, улица, дом, этаж/офис.</i>",
    { inlineKeyboard: [backToMenuRow()] },
  );
}

async function newRequestAddress(ctx: BotContext) {
  const data = ctx.state?.data || {};
  data.address = ctx.text;
  await ctx.setState("new_request", "contact", data);

  // Если клиент уже привязан и у нас есть телефон — пропускаем шаг контакта
  if (ctx.client && !ctx.client.phone.startsWith("unknown-")) {
    data.phone = ctx.client.phone;
    data.name = ctx.client.name;
    return finalizeRequest(ctx, data);
  }

  await ctx.send(
    "<b>Шаг 5 из 5</b> — поделитесь контактом или напишите телефон текстом.\n\n" +
      "<i>Нажмите кнопку ниже — это быстрее всего.</i>",
    {
      replyKeyboard: [[{ text: "📱 Поделиться номером", requestContact: true }]],
    },
  );
}

async function handleContact(ctx: BotContext) {
  if (!ctx.contact) return;
  const phone = normalizePhone(ctx.contact.phone);
  const name = [ctx.contact.firstName, ctx.contact.lastName].filter(Boolean).join(" ") || ctx.displayName || "Клиент";

  // Привязываем телеграм-канал к клиенту
  await linkChannel(ctx, phone, name);

  // Если шёл flow — продолжаем
  if (ctx.state?.flow === "new_request" && ctx.state.step === "contact") {
    const data = ctx.state.data || {};
    data.phone = phone;
    data.name = name;
    await ctx.send("Спасибо, номер записал.", { removeKeyboard: true });
    return finalizeRequest(ctx, data);
  }

  await ctx.send(
    `Контакт привязан: ${phone}. Теперь я буду присылать уведомления о ваших заявках.`,
    { removeKeyboard: true },
  );
}

async function newRequestContactText(ctx: BotContext) {
  const text = ctx.text || "";
  const digits = text.replace(/\D/g, "");
  if (digits.length < 10) {
    return ctx.send("Не похоже на номер. Попробуйте ещё раз: пример +79991234567");
  }
  const phone = normalizePhone(text);
  const data = ctx.state?.data || {};
  data.phone = phone;
  data.name = ctx.displayName || "Клиент";
  await linkChannel(ctx, phone, data.name);
  return finalizeRequest(ctx, data);
}

async function finalizeRequest(ctx: BotContext, data: any) {
  const phone = data.phone;
  let client = await prisma.client.findUnique({ where: { phone } });
  if (!client) {
    client = await prisma.client.create({ data: { name: data.name, phone } });
  }

  // Адрес
  let addressId: string | null = null;
  if (data.address) {
    const addr = await prisma.address.create({ data: { clientId: client.id, ...(await enrichAddress(data.address)) } });
    addressId = addr.id;
  }

  // Если в ходе диалога клиент упомянул модель принтера (через поиск картриджа
  // или свой текст) — сохраняем её в карточку клиента, чтобы в следующий раз
  // мастер увидел технику без расспросов.
  const items: any[] = Array.isArray(data.items) ? data.items : [];
  const printerQueries = [data.lastSearch, ...items.map((it) => it.label).filter(Boolean)].filter(Boolean) as string[];
  await savePrinterFromQueries(client.id, printerQueries);

  // Корзина → printerInfo (сжатая строка) + comment (детальная)
  const printerInfo = items.length
    ? items.map((it) => `${it.label}${it.quantity > 1 ? ` ×${it.quantity}` : ""}`).join(", ")
    : (data.printerInfo === "не знаю" ? null : data.printerInfo) || null;

  const total = cartTotal(items);
  const detailLines = items.map((it) => {
    const lineTotal = (it.price + (it.withChip ? it.chipPrice : 0)) * it.quantity;
    const parts = [`• ${it.label} ×${it.quantity}`];
    if (it.price) parts.push(`заправка ${Math.round(it.price / 100)}₽`);
    if (it.withChip) parts.push(`+чип ${Math.round(it.chipPrice / 100)}₽`);
    if (lineTotal) parts.push(`= ${Math.round(lineTotal / 100)}₽`);
    if (it.isCustom) parts.push("(уточнить)");
    return parts.join(" · ");
  });
  const commentParts: string[] = [];
  if (detailLines.length) commentParts.push("Состав:\n" + detailLines.join("\n"));
  if (total) commentParts.push(`Итого ориентировочно: ${formatRub(total)}`);
  if (data.whenChoice === "week") commentParts.push("Клиент готов обсудить дату");

  // Номер заявки
  const last = await prisma.request.findFirst({ orderBy: { number: "desc" }, select: { number: true } });
  const request = await prisma.request.create({
    data: {
      number: (last?.number ?? 0) + 1,
      clientId: client.id,
      addressId,
      serviceId: data.serviceId || null,
      printerInfo,
      price: total || null,
      scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
      status: data.scheduledAt ? "SCHEDULED" : "NEW",
      source: "TELEGRAM",
      comment: commentParts.length ? commentParts.join("\n\n") : null,
    },
    include: { service: true, address: true },
  });

  await ctx.clearState();
  await ctx.send(
    `✅ <b>Заявка #${request.number} принята</b>\n\n` +
      `Услуга: ${request.service?.name || "уточним"}\n` +
      (items.length
        ? `Картриджи:\n${detailLines.map((l) => "  " + l).join("\n")}\n${total ? `\n<b>Итого ~${formatRub(total)}</b>\n` : ""}`
        : printerInfo ? `Картридж: ${printerInfo}\n` : "") +
      (request.address ? `Адрес: ${shortenSpbAddress(request.address.address) || request.address.address}\n` : "") +
      (request.scheduledAt
        ? `Время: ${format(request.scheduledAt, "d MMMM, HH:mm", { locale: ru })}\n`
        : "Время: согласуем\n") +
      `\nМастер свяжется в ближайшее время.`,
    {
      inlineKeyboard: [
        [{ text: "📋 Все мои заявки", callbackData: "my_requests" }],
        backToMenuRow(),
      ],
    },
  );
  notifyAdminsNewRequest(request.id).catch((e) => console.error("[bot] admin notify failed", e));
}

async function continueNewRequest(ctx: BotContext) {
  const step = ctx.state?.step;
  // Старая ветка для совместимости: если в state.cartridge юзер пишет текст — трактуем
  // как «своя модель», добавляем в корзину
  if (step === "cartridge") return cartCustomReceived(ctx);
  // Новые шаги корзины
  if (step === "cartridge_custom") return cartCustomReceived(ctx);
  if (step === "cartridge_search") return cartSearchReceived(ctx);
  if (step === "address") return newRequestAddress(ctx);
  if (step === "contact") return newRequestContactText(ctx);
  // Если на шаге service/when ждём callback — текст не понимаем
  await ctx.send("Воспользуйтесь кнопками выше или /cancel чтобы начать заново.", {
    inlineKeyboard: [backToMenuRow()],
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN — quick request creation

type AdminDraft = {
  phone?: string;
  name?: string;
  serviceId?: string;
  serviceName?: string;
  printerInfo?: string;
  scheduledAt?: string | null;
  whenText?: string;
  address?: string;
  comment?: string;
  assignedToId?: string | null;
  assignedToName?: string | null;
};

async function adminMenu(ctx: BotContext) {
  if (!ctx.user) return;
  const [today, newCount] = await Promise.all([
    prisma.request.count({
      where: {
        scheduledAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
          lt: new Date(new Date().setHours(23, 59, 59, 999)),
        },
      },
    }),
    prisma.request.count({ where: { status: "NEW" } }),
  ]);

  await ctx.send(
    `<b>${ctx.user.name}</b>\n\n` +
      `Сегодня в календаре: <b>${today}</b>\n` +
      `Новых без даты: <b>${newCount}</b>\n\n` +
      `Чтобы быстро создать заявку, просто напишите одной строкой:\n` +
      `<i>Иван +79991234567 заправка 3050 завтра Лиговский 50</i>`,
    {
      inlineKeyboard: [
        [{ text: "➕ Новая заявка", callbackData: "admin:new" }],
        [{ text: "📅 Сегодня", callbackData: "admin:today" }],
      ],
    },
  );
}

async function adminToday(ctx: BotContext) {
  if (!isAdmin(ctx)) return;
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end = new Date(); end.setHours(23, 59, 59, 999);
  const items = await prisma.request.findMany({
    where: {
      OR: [
        { scheduledAt: { gte: start, lte: end } },
        { status: { in: ["NEW", "ACCEPTED", "EN_ROUTE", "ON_SITE", "IN_PROGRESS"] } },
      ],
    },
    include: { client: true, service: true, address: true, assignedTo: true },
    orderBy: [{ scheduledAt: "asc" }, { createdAt: "desc" }],
    take: 12,
  });
  if (!items.length) {
    return ctx.send("На сегодня заявок нет.", {
      inlineKeyboard: [[{ text: "➕ Новая заявка", callbackData: "admin:new" }]],
    });
  }
  const lines = items.map((r) => {
    const time = r.scheduledAt ? format(r.scheduledAt, "HH:mm", { locale: ru }) : "без даты";
    return [
      `<b>#${r.number}</b> · ${statusEmoji(r.status)} ${statusLabel(r.status)}`,
      `${time} · ${r.service?.name || "услуга"}`,
      `${r.client.name} · ${r.client.phone}`,
      r.address ? (shortenSpbAddress(r.address.address) || r.address.address) : null,
      r.assignedTo ? `Мастер: ${r.assignedTo.name}` : null,
    ].filter(Boolean).join("\n");
  });
  return ctx.send(`<b>Сегодня и активные:</b>\n\n${lines.join("\n\n")}`, {
    inlineKeyboard: [[{ text: "➕ Новая заявка", callbackData: "admin:new" }]],
  });
}

async function startAdminRequest(ctx: BotContext, seedText = "") {
  const data = seedText ? await parseAdminDraft(seedText) : {};
  await ctx.setState("admin_request", "draft", data);
  return nextAdminQuestion(ctx, data);
}

async function continueAdminRequest(ctx: BotContext) {
  const step = ctx.state?.step;
  const data: AdminDraft = ctx.state?.data || {};
  const text = (ctx.text || "").trim();
  if (!text) return nextAdminQuestion(ctx, data);

  if (step === "phone") {
    const phone = extractPhone(text);
    if (!phone) return ctx.send("Не похоже на телефон. Напишите номер, например +79991234567.");
    data.phone = phone.normalized;
    if (!data.name) data.name = extractName(text, phone.raw) || undefined;
  } else if (step === "name") {
    data.name = isSkipText(text) ? undefined : text;
  } else if (step === "printer") {
    data.printerInfo = isSkipText(text) ? undefined : text;
  } else if (step === "address") {
    data.address = isSkipText(text) ? undefined : text;
  } else if (step === "comment") {
    data.comment = isSkipText(text) ? undefined : text;
  } else if (step === "when_custom") {
    const parsed = parseWhen(text);
    data.scheduledAt = parsed.date ? parsed.date.toISOString() : null;
    data.whenText = parsed.label || (isSkipText(text) ? "без даты" : text);
  } else {
    const parsed = await parseAdminDraft(text);
    Object.assign(data, compactDraft(parsed));
  }

  await ctx.setState("admin_request", "draft", data);
  return nextAdminQuestion(ctx, data);
}

async function nextAdminQuestion(ctx: BotContext, data: AdminDraft) {
  if (!data.phone) {
    await ctx.setState("admin_request", "phone", data);
    return ctx.send("Телефон клиента?\n\nМожно сразу фразой: <i>Иван +79991234567 заправка 3050 завтра адрес</i>");
  }
  if (!data.serviceId) {
    const services = await prisma.service.findMany({ orderBy: { name: "asc" } });
    await ctx.setState("admin_request", "service", data);
    return ctx.send(`Телефон: <b>${data.phone}</b>\n\nЧто нужно сделать?`, {
      inlineKeyboard: [
        ...services.map((s) => [{ text: `${serviceEmoji(s.slug)} ${s.name}`, callbackData: `admin:svc:${s.id}` }]),
        [{ text: "Отмена", callbackData: "cancel_flow" }],
      ],
    });
  }
  await ctx.setState("admin_request", "confirm", data);
  return sendAdminConfirm(ctx, data);
}

async function adminServicePicked(ctx: BotContext, serviceId: string) {
  if (!isAdmin(ctx)) return;
  const service = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!service) return;
  const data: AdminDraft = ctx.state?.data || {};
  data.serviceId = service.id;
  data.serviceName = service.name;
  await ctx.setState("admin_request", "confirm", data);
  return nextAdminQuestion(ctx, data);
}

async function adminEditField(ctx: BotContext, field: string) {
  if (!isAdmin(ctx)) return;
  const data: AdminDraft = ctx.state?.data || {};
  if (field === "service") {
    data.serviceId = undefined;
    data.serviceName = undefined;
    await ctx.setState("admin_request", "service", data);
    return nextAdminQuestion(ctx, data);
  }
  if (field === "when") {
    return ctx.send("Когда поставить?", {
      inlineKeyboard: [
        [
          { text: "Сейчас", callbackData: "admin:when:now" },
          { text: "Сегодня 16:00", callbackData: "admin:when:today16" },
        ],
        [
          { text: "Завтра 10:00", callbackData: "admin:when:tomorrow10" },
          { text: "Завтра 16:00", callbackData: "admin:when:tomorrow16" },
        ],
        [
          { text: "Ввести текстом", callbackData: "admin:when:custom" },
          { text: "Без даты", callbackData: "admin:when:none" },
        ],
      ],
    });
  }
  if (field === "master") {
    const masters = await prisma.user.findMany({
      where: { active: true, role: { in: ["MASTER", "ADMIN"] } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
    return ctx.send("Назначить мастера?", {
      inlineKeyboard: [
        ...masters.map((m) => [{ text: m.name, callbackData: `admin:master:${m.id}` }]),
        [{ text: "Не назначать", callbackData: "admin:master:none" }],
      ],
    });
  }

  const prompts: Record<string, string> = {
    name: "Имя клиента? Можно написать «пропустить».",
    phone: "Новый телефон клиента?",
    printer: "Картридж или принтер? Например: 3050, CF283A. Можно «пропустить».",
    address: "Адрес? Можно «пропустить».",
    comment: "Комментарий? Можно «пропустить».",
  };
  const stepByField: Record<string, string> = {
    printer: "printer",
    name: "name",
    phone: "phone",
    address: "address",
    comment: "comment",
  };
  const step = stepByField[field];
  if (!step) return sendAdminConfirm(ctx, data);
  await ctx.setState("admin_request", step, data);
  return ctx.send(prompts[field]);
}

async function adminSkipField(ctx: BotContext, field: string) {
  if (!isAdmin(ctx)) return;
  const data: AdminDraft = ctx.state?.data || {};
  if (field === "name") data.name = undefined;
  if (field === "printer") data.printerInfo = undefined;
  if (field === "address") data.address = undefined;
  if (field === "comment") data.comment = undefined;
  if (field === "when") {
    data.scheduledAt = null;
    data.whenText = "без даты";
  }
  await ctx.setState("admin_request", "confirm", data);
  return sendAdminConfirm(ctx, data);
}

async function adminWhenPicked(ctx: BotContext, value: string) {
  if (!isAdmin(ctx)) return;
  const data: AdminDraft = ctx.state?.data || {};
  if (value === "custom") {
    await ctx.setState("admin_request", "when_custom", data);
    return ctx.send("Напишите время текстом: <i>сегодня 15</i>, <i>завтра после 12</i>, <i>25.05 10:30</i>.");
  }
  const now = new Date();
  if (value === "now") {
    data.scheduledAt = now.toISOString();
    data.whenText = "сейчас";
  } else if (value === "today16") {
    data.scheduledAt = setMinutes(setHours(now, 16), 0).toISOString();
    data.whenText = "сегодня 16:00";
  } else if (value === "tomorrow10") {
    data.scheduledAt = setMinutes(setHours(addDays(now, 1), 10), 0).toISOString();
    data.whenText = "завтра 10:00";
  } else if (value === "tomorrow16") {
    data.scheduledAt = setMinutes(setHours(addDays(now, 1), 16), 0).toISOString();
    data.whenText = "завтра 16:00";
  } else {
    data.scheduledAt = null;
    data.whenText = "без даты";
  }
  await ctx.setState("admin_request", "confirm", data);
  return sendAdminConfirm(ctx, data);
}

async function adminMasterPicked(ctx: BotContext, value: string) {
  if (!isAdmin(ctx)) return;
  const data: AdminDraft = ctx.state?.data || {};
  if (value === "none") {
    data.assignedToId = null;
    data.assignedToName = null;
  } else {
    const master = await prisma.user.findUnique({ where: { id: value }, select: { id: true, name: true } });
    data.assignedToId = master?.id || null;
    data.assignedToName = master?.name || null;
  }
  await ctx.setState("admin_request", "confirm", data);
  return sendAdminConfirm(ctx, data);
}

async function sendAdminConfirm(ctx: BotContext, data: AdminDraft) {
  const lines = [
    "<b>Проверь заявку:</b>",
    "",
    `Клиент: ${data.name || "уточнить"}`,
    `Телефон: ${data.phone || "не указан"}`,
    `Услуга: ${data.serviceName || "не выбрана"}`,
    data.printerInfo ? `Картридж/принтер: ${data.printerInfo}` : null,
    `Время: ${formatAdminWhen(data)}`,
    data.address ? `Адрес: ${data.address}` : null,
    data.assignedToName ? `Мастер: ${data.assignedToName}` : null,
    data.comment ? `Комментарий: ${data.comment}` : null,
  ].filter(Boolean);

  await ctx.send(lines.join("\n"), {
    inlineKeyboard: [
      [{ text: "✅ Создать", callbackData: "admin:confirm" }],
      [
        { text: "Имя", callbackData: "admin:edit:name" },
        { text: "Телефон", callbackData: "admin:edit:phone" },
        { text: "Услуга", callbackData: "admin:edit:service" },
      ],
      [
        { text: "Дата/время", callbackData: "admin:edit:when" },
        { text: "Адрес", callbackData: "admin:edit:address" },
      ],
      [
        { text: "Картридж", callbackData: "admin:edit:printer" },
        { text: "Комментарий", callbackData: "admin:edit:comment" },
        { text: "Мастер", callbackData: "admin:edit:master" },
      ],
      [{ text: "Отмена", callbackData: "cancel_flow" }],
    ],
  });
}

async function createAdminRequest(ctx: BotContext) {
  if (!isAdmin(ctx)) return;
  const data: AdminDraft = ctx.state?.data || {};
  if (!data.phone || !data.serviceId) return nextAdminQuestion(ctx, data);

  let client = await prisma.client.findUnique({ where: { phone: data.phone } });
  if (!client) {
    client = await prisma.client.create({
      data: { name: data.name?.trim() || `Клиент ${data.phone}`, phone: data.phone },
    });
  } else if (data.name && data.name !== client.name) {
    client = await prisma.client.update({ where: { id: client.id }, data: { name: data.name } });
  }

  let addressId: string | null = null;
  if (data.address) {
    const addr = await prisma.address.create({ data: { clientId: client.id, ...(await enrichAddress(data.address)) } });
    addressId = addr.id;
  }

  // Если админ указал технику в printerInfo — пытаемся опознать модель
  // принтера по каталогу и сохранить в карточку клиента.
  if (data.printerInfo) {
    await savePrinterFromQueries(client.id, [data.printerInfo]);
  }

  const last = await prisma.request.findFirst({ orderBy: { number: "desc" }, select: { number: true } });
  const request = await prisma.request.create({
    data: {
      number: (last?.number ?? 0) + 1,
      clientId: client.id,
      addressId,
      serviceId: data.serviceId,
      assignedToId: data.assignedToId || null,
      scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
      printerInfo: data.printerInfo || null,
      comment: data.comment || null,
      status: data.scheduledAt ? "SCHEDULED" : "NEW",
      source: ctx.provider,
    },
    include: { service: true, assignedTo: true, address: true, client: true },
  });

  await ctx.clearState();
  const base = process.env.PUBLIC_BASE_URL?.replace(/\/+$/, "");
  await ctx.send(
    `✅ <b>Заявка #${request.number} создана</b>\n\n` +
      `${request.client.name}\n` +
      `${request.client.phone}\n` +
      `${request.service?.name || "Услуга"}\n` +
      (request.scheduledAt ? `Время: ${format(request.scheduledAt, "d MMMM, HH:mm", { locale: ru })}\n` : "Время: без даты\n") +
      (request.assignedTo ? `Мастер: ${request.assignedTo.name}\n` : "") +
      (base ? `\nCRM: ${base}/crm/requests/${request.id}` : ""),
    {
      inlineKeyboard: [
        [
          { text: "➕ Добавить ещё", callbackData: "admin:new" },
          { text: "Главное меню", callbackData: "admin:menu" },
        ],
      ],
    },
  );
}

async function parseAdminDraft(text: string): Promise<AdminDraft> {
  const phone = extractPhone(text);
  const services = await prisma.service.findMany({ orderBy: { name: "asc" } });
  const service = detectService(text, services);
  const when = parseWhen(text);
  const address = extractAddress(text);
  const printerInfo = extractPrinterInfo(text);
  const name = phone ? extractName(text, phone.raw) : undefined;

  return {
    phone: phone?.normalized,
    name,
    serviceId: service?.id,
    serviceName: service?.name,
    printerInfo,
    scheduledAt: when.date ? when.date.toISOString() : undefined,
    whenText: when.label,
    address,
  };
}

function compactDraft(data: AdminDraft) {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined && value !== ""));
}

function extractPhone(text: string) {
  const candidates = text.match(/(?:\+?\d[\d\s().-]{8,}\d)/g) || [];
  for (const raw of candidates) {
    const digits = raw.replace(/\D/g, "");
    if (digits.length >= 10) return { raw, normalized: normalizePhone(raw) };
  }
  return null;
}

function detectService(text: string, services: { id: string; name: string; slug: string; kind: string }[]) {
  const lower = text.toLowerCase();
  const bySlug = (slug: string) => services.find((service) => service.slug === slug);
  if (/заправ|тонер|zaprav|refill/.test(lower)) return bySlug("zapravka");
  if (/замен|zamena|replace/.test(lower)) return bySlug("zamena");
  if (/диагност|провер|diagnost|check/.test(lower)) return bySlug("diagnostika");
  if (/ремонт|чин|слом|не печат|зажев|полос|remont|repair/.test(lower)) return bySlug("remont");
  return services.find((service) => lower.includes(service.name.toLowerCase()));
}

function parseWhen(text: string): { date: Date | null; label?: string } {
  const lower = text.toLowerCase();
  const now = new Date();
  const time = lower.match(/(?:в|на|после)?\s*(\d{1,2})(?::|\.)(\d{2})/) || lower.match(/(?:в|на|после)\s+(\d{1,2})/);
  const hour = time ? clamp(Number(time[1]), 8, 21) : null;
  const minute = time?.[2] ? Number(time[2]) : 0;

  if (/сейчас|срочно|как можно скорее|побыстр/.test(lower)) return { date: now, label: "сейчас" };
  if (/завтра/.test(lower)) {
    const d = addDays(now, 1);
    const h = hour ?? (/после обед|после 12/.test(lower) ? 14 : 10);
    return { date: setMinutes(setHours(d, h), minute), label: `завтра ${String(h).padStart(2, "0")}:${String(minute).padStart(2, "0")}` };
  }
  if (/сегодня/.test(lower)) {
    const h = hour ?? (/после обед|после 12/.test(lower) ? 14 : 16);
    return { date: setMinutes(setHours(now, h), minute), label: `сегодня ${String(h).padStart(2, "0")}:${String(minute).padStart(2, "0")}` };
  }
  const date = lower.match(/\b(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?\b/);
  if (date) {
    const year = date[3] ? Number(date[3].length === 2 ? `20${date[3]}` : date[3]) : now.getFullYear();
    const d = new Date(year, Number(date[2]) - 1, Number(date[1]), hour ?? 10, minute, 0, 0);
    return { date: d, label: format(d, "d MMMM, HH:mm", { locale: ru }) };
  }
  return { date: null };
}

function extractAddress(text: string) {
  const match = text.match(/(?:^|\s)(адрес|ул\.?|улица|пр\.?|проспект|шоссе|наб\.?|набережная|пер\.?|переулок|пл\.?|площадь)\s+(.+)$/i);
  if (!match) return undefined;
  return `${match[1]} ${match[2]}`.replace(/^адрес\s+/i, "").trim();
}

function extractPrinterInfo(text: string) {
  const match = text.match(/\b([A-ZА-Я]{1,5}[-\s]?\d{2,5}[A-ZА-Я]?|\d{3,5}[A-ZА-Я]?|CF\d{3}[AX]?|CE\d{3}A|Q\d{4}A|TN[-\s]?\d{4})\b/i);
  return match?.[1]?.trim();
}

function extractName(text: string, rawPhone: string) {
  const beforePhone = text.split(rawPhone)[0]?.trim();
  if (!beforePhone) return undefined;
  const cleaned = beforePhone
    .replace(/\b(новая|заявка|клиент|заказ|нужно|надо)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned || /\d/.test(cleaned)) return undefined;
  return cleaned.split(" ").slice(0, 3).join(" ");
}

function formatAdminWhen(data: AdminDraft) {
  if (data.scheduledAt) return format(new Date(data.scheduledAt), "d MMMM, HH:mm", { locale: ru });
  return data.whenText || "без даты";
}

function isSkipText(text: string) {
  return ["нет", "не", "пропустить", "-", "без", "позже"].includes(text.trim().toLowerCase());
}

function isAdmin(ctx: BotContext) {
  return ctx.user?.role === "ADMIN";
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

// ── CART helpers ────────────────────────────────────────────────────────────
function cartTotal(items: any[]) {
  return (items || []).reduce(
    (sum, it) => sum + (it.price + (it.withChip ? it.chipPrice : 0)) * (it.quantity || 1),
    0,
  );
}

/** Окончание для русских числительных: 1 заявка, 2 заявки, 5 заявок */
function endingMatch(n: number, one: string, few: string, many: string) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

// ─────────────────────────────────────────────────────────────────────────────
// МАСТЕР

async function masterMenu(ctx: BotContext) {
  if (!ctx.user) return;
  const today = await prisma.request.count({
    where: {
      assignedToId: ctx.user.id,
      scheduledAt: {
        gte: new Date(new Date().setHours(0, 0, 0, 0)),
        lt: new Date(new Date().setHours(23, 59, 59, 999)),
      },
    },
  });
  const newCount = await prisma.request.count({ where: { status: "NEW" } });
  const inProgress = await prisma.request.count({
    where: { assignedToId: ctx.user.id, status: { in: ["ACCEPTED", "SCHEDULED", "EN_ROUTE", "ON_SITE", "IN_PROGRESS"] } },
  });

  await ctx.send(
    `🛠 <b>${ctx.user.name}</b> · мастер\n\n` +
      `📅 На сегодня: <b>${today}</b>\n` +
      `🚗 Сейчас в работе: <b>${inProgress}</b>\n` +
      `🆕 Новых без даты: <b>${newCount}</b>`,
    {
      inlineKeyboard: [
        [{ text: "📅 Расписание сегодня", callbackData: "master:today" }],
        [{ text: "🚗 Следующая заявка", callbackData: "master:next" }],
      ],
    },
  );
}

async function masterToday(ctx: BotContext) {
  if (!ctx.user) return;
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end = new Date(); end.setHours(23, 59, 59, 999);
  const items = await prisma.request.findMany({
    where: {
      OR: [
        { assignedToId: ctx.user.id, scheduledAt: { gte: start, lte: end } },
        { status: { in: ["ACCEPTED", "SCHEDULED", "IN_PROGRESS", "EN_ROUTE", "ON_SITE"] }, assignedToId: ctx.user.id },
      ],
    },
    include: { client: true, service: true, address: true },
    orderBy: { scheduledAt: "asc" },
  });
  if (items.length === 0) return ctx.send("На сегодня пусто.");
  for (const r of items) {
    await sendMasterCard(ctx, r);
  }
}

async function masterNext(ctx: BotContext) {
  if (!ctx.user) return;
  const r = await prisma.request.findFirst({
    where: { assignedToId: ctx.user.id, status: { in: ["ACCEPTED", "SCHEDULED", "EN_ROUTE", "ON_SITE", "IN_PROGRESS"] } },
    include: { client: true, service: true, address: true },
    orderBy: { scheduledAt: "asc" },
  });
  if (!r) return ctx.send("Активных заявок нет.");
  return sendMasterCard(ctx, r);
}

async function sendMasterCard(ctx: BotContext, r: any) {
  const time = r.scheduledAt ? format(r.scheduledAt, "HH:mm", { locale: ru }) : "без даты";
  const lines = [
    `<b>#${r.number}</b> · ${statusEmoji(r.status)} ${statusLabel(r.status)}`,
    `${time} · ${r.service?.name || "—"}`,
    `👤 ${r.client.name}`,
    `📞 ${r.client.phone}`,
  ];
  if (r.address) lines.push(`📍 ${shortenSpbAddress(r.address.address) || r.address.address}`);
  if (r.printerInfo) lines.push(`🖨 ${r.printerInfo}`);
  if (r.comment) lines.push(`💬 ${r.comment}`);

  const buttons: any[] = [];
  if (r.status === "NEW") buttons.push({ text: "🙋 Принять", callbackData: `req:${r.id}:claim` });
  if (r.status === "ACCEPTED" || r.status === "SCHEDULED") buttons.push({ text: "🚗 В пути", callbackData: `req:${r.id}:enroute` });
  if (r.status === "EN_ROUTE") buttons.push({ text: "📍 На месте", callbackData: `req:${r.id}:onsite` });
  if (r.status === "ON_SITE") buttons.push({ text: "🛠 Начать работу", callbackData: `req:${r.id}:start` });
  if (r.status === "IN_PROGRESS") buttons.push({ text: "🏁 Завершить", callbackData: `req:${r.id}:done` });
  if (r.status === "AWAITING_PAYMENT") buttons.push({ text: "💰 Получена оплата", callbackData: `req:${r.id}:paid` });

  await ctx.send(lines.join("\n"), {
    inlineKeyboard: buttons.length ? [buttons] : undefined,
  });
}

async function masterRequestAction(ctx: BotContext, payload: string) {
  if (!ctx.user) return;
  const [id, action] = payload.split(":");

  // «Принять на себя» — назначает текущего сотрудника мастером и переводит в ACCEPTED.
  if (action === "claim") {
    const existing = await prisma.request.findUnique({
      where: { id },
      select: { id: true, assignedToId: true, assignedTo: { select: { name: true } }, status: true },
    });
    if (!existing) return ctx.send("Заявка не найдена.");
    if (existing.assignedToId && existing.assignedToId !== ctx.user.id) {
      return ctx.send(`Уже взял на себя: ${existing.assignedTo?.name || "другой мастер"}.`);
    }
    await prisma.request.update({
      where: { id },
      data: {
        assignedToId: ctx.user.id,
        ...(existing.status === "NEW" ? { status: "ACCEPTED" } : {}),
      },
    });
    return ctx.send(`✅ Взяли на себя заявку #${shortNumber(id)}. Дальше — /today.`);
  }

  const map: Record<string, string> = {
    enroute: "EN_ROUTE",
    onsite: "ON_SITE",
    start: "IN_PROGRESS",
    done: "DONE",
    paid: "DONE",
  };
  const newStatus = map[action];
  if (!newStatus) return;
  const updated = await prisma.request.update({
    where: { id },
    data: {
      status: newStatus,
      ...(newStatus === "DONE" ? { paymentStatus: "PAID" } : {}),
      ...(newStatus === "ON_SITE" || newStatus === "IN_PROGRESS" ? { scheduledAt: new Date() } : {}),
    },
  });
  // Уведомим клиента отдельно (как делает CRM transition)
  const { notifyClientStatusChange } = await import("./notify");
  notifyClientStatusChange(updated.id, updated.status).catch((e) => console.error("[bot notify]", e));
  await ctx.send(`Статус изменён на «${statusLabel(newStatus)}».`);
}

function shortNumber(id: string) {
  return id.slice(-6);
}

// ─────────────────────────────────────────────────────────────────────────────
// Pairing через deep-link

async function handlePairing(ctx: BotContext, token: string) {
  const pair = await prisma.pairingToken.findUnique({ where: { token: token.toUpperCase() } });
  if (!pair) {
    return ctx.send("Код привязки не найден. Запросите новую ссылку в CRM → Боты.");
  }
  if (pair.usedAt) {
    return ctx.send("Этот код уже использован. Запросите новый в CRM.");
  }
  if (pair.expiresAt < new Date()) {
    return ctx.send("Код истёк. Запросите новый в CRM.");
  }
  if (pair.provider !== ctx.provider) {
    return ctx.send(`Код выдан для ${pair.provider}, а вы пишете из ${ctx.provider}.`);
  }

  // Привязываем chat_id к сотруднику
  try {
    await prisma.user.update({
      where: { id: pair.userId },
      data: pair.provider === "TELEGRAM" ? { telegramId: ctx.chatId } : { maxId: ctx.chatId },
    });
  } catch (e: any) {
    if (e?.code === "P2002") {
      return ctx.send("Этот chat id уже привязан к другому сотруднику. Сообщите администратору.");
    }
    throw e;
  }

  await prisma.pairingToken.update({ where: { id: pair.id }, data: { usedAt: new Date() } });

  const user = await prisma.user.findUnique({ where: { id: pair.userId }, select: { name: true, role: true } });
  await ctx.send(
    `✅ Привязка успешна!\n\nЗдравствуйте, <b>${user?.name || "коллега"}</b>.\n` +
      `Теперь бот узнаёт вас как ${user?.role === "ADMIN" ? "администратора" : "мастера"}.\n\n` +
      `Меню — /start`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Утилиты

async function linkChannel(ctx: BotContext, phone: string, name: string) {
  let client = await prisma.client.findUnique({ where: { phone } });
  if (!client) {
    client = await prisma.client.create({ data: { name, phone } });
  }
  await prisma.clientChannel.upsert({
    where: { provider_externalId: { provider: ctx.provider, externalId: ctx.chatId } },
    create: { clientId: client.id, provider: ctx.provider, externalId: ctx.chatId },
    update: { clientId: client.id },
  });
}

function statusLabel(s: string) {
  return ({
    NEW: "Новая",
    ACCEPTED: "Принята",
    SCHEDULED: "Запланирована",
    EN_ROUTE: "Мастер в пути",
    ON_SITE: "На месте",
    IN_PROGRESS: "В работе",
    AWAITING_PAYMENT: "Ожидает оплаты",
    DONE: "Выполнена",
    CANCELLED: "Отменена",
  } as Record<string, string>)[s] || s;
}

function statusEmoji(s: string) {
  return ({
    NEW: "🆕",
    ACCEPTED: "✅",
    SCHEDULED: "📅",
    EN_ROUTE: "🚗",
    ON_SITE: "📍",
    IN_PROGRESS: "🛠",
    AWAITING_PAYMENT: "💰",
    DONE: "✅",
    CANCELLED: "✖️",
  } as Record<string, string>)[s] || "•";
}

function serviceEmoji(slug: string) {
  return ({
    zapravka: "💧",
    zamena: "🔄",
    diagnostika: "🩺",
    remont: "🔧",
  } as Record<string, string>)[slug] || "•";
}

/**
 * По списку строк (что клиент писал про технику — модели картриджей, запрос
 * на поиск, свободный текст) находим в каталоге PrinterModel первое совпадение
 * и записываем модель в карточку клиента (Printer). Если такой принтер уже
 * есть у клиента — пропускаем.
 *
 * Это делает повторные обращения короче: в CRM мастер сразу видит технику,
 * клиенту не приходится снова диктовать модель.
 */
async function savePrinterFromQueries(clientId: string, queries: string[]) {
  const seen = new Set<string>();
  for (const raw of queries) {
    const q = (raw || "").trim();
    if (q.length < 2) continue;
    if (seen.has(q.toLowerCase())) continue;
    seen.add(q.toLowerCase());

    const match = await prisma.printerModel.findFirst({
      where: {
        OR: [
          { family: { contains: q } },
          { aliases: { contains: q } },
        ],
      },
    }).catch(() => null);
    if (!match) continue;

    const exists = await prisma.printer.findFirst({
      where: { clientId, brand: match.brand, model: match.family },
    });
    if (exists) return; // у клиента уже есть этот принтер — не дублируем

    await prisma.printer.create({
      data: { clientId, brand: match.brand, model: match.family },
    }).catch((e) => console.error("[bot] save printer failed", e));
    return;
  }
}
