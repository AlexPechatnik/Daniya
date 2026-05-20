import { prisma } from "../db";
import type { BotContext } from "./runner";
import { normalizePhone, formatRub } from "../utils";
import { company } from "../company";
import { format, addDays, setHours, setMinutes } from "date-fns";
import { ru } from "date-fns/locale";
import { notifyAdminsNewRequest } from "./notify";

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

  // Если активен flow — продолжаем его
  if (ctx.state?.flow === "new_request") {
    return continueNewRequest(ctx);
  }
  if (ctx.state?.flow === "admin_request") {
    return continueAdminRequest(ctx);
  }

  if (isAdmin(ctx) && ctx.text) {
    return startAdminRequest(ctx, ctx.text);
  }

  // Свободный текст без активного flow — записываем в общий чат
  if (ctx.client && ctx.text) {
    // Уже залогировано в runner. Просто подтвердим, что мы получили.
    await ctx.send(
      "Сообщение записано — мастер увидит его в CRM.\n\nНужно создать новую заявку? — /start",
    );
    return;
  }

  // Незнакомый клиент пишет произвольный текст — предлагаем оставить заявку
  return clientWelcome(ctx);
}

export async function handleCallback(ctx: BotContext) {
  const data = ctx.callbackData;
  if (!data) return;

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
    return ctx.send("Отменил.");
  }

  // Шаги wizard'а
  if (data.startsWith("svc:")) {
    return newRequestServicePicked(ctx, data.slice(4));
  }
  if (data.startsWith("when:")) {
    return newRequestWhenPicked(ctx, data.slice(5));
  }

  if (data.startsWith("admin:svc:")) return adminServicePicked(ctx, data.slice("admin:svc:".length));
  if (data.startsWith("admin:when:")) return adminWhenPicked(ctx, data.slice("admin:when:".length));
  if (data.startsWith("admin:edit:")) return adminEditField(ctx, data.slice("admin:edit:".length));
  if (data.startsWith("admin:skip:")) return adminSkipField(ctx, data.slice("admin:skip:".length));
  if (data.startsWith("admin:master:")) return adminMasterPicked(ctx, data.slice("admin:master:".length));

  // Мастерские действия по заявке (включая req:<id>:claim)
  if (data.startsWith("req:")) {
    return masterRequestAction(ctx, data.slice(4));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// КЛИЕНТ — главное меню и приветствие

async function clientWelcome(ctx: BotContext) {
  const name = ctx.displayName ? `, ${ctx.displayName.split(" ")[0]}` : "";
  await ctx.send(
    `<b>${company.name}</b> — выездной сервис принтеров в ${company.city}\n\n` +
      `Здравствуйте${name}! Я помогу:\n` +
      `• оставить заявку на заправку, замену, диагностику или ремонт\n` +
      `• посмотреть статус ваших заявок\n` +
      `• связаться с мастером\n\n` +
      `С чего начнём?`,
    {
      inlineKeyboard: [
        [{ text: "📝 Оставить заявку", callbackData: "new_request" }],
        [{ text: "📋 Мои заявки", callbackData: "my_requests" }],
      ],
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
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// КЛИЕНТ — список заявок

async function clientStatus(ctx: BotContext) {
  if (!ctx.client) {
    return ctx.send("У вас пока нет заявок. Создать первую? — /start");
  }
  const requests = await prisma.request.findMany({
    where: { clientId: ctx.client.id },
    include: { service: true, assignedTo: true },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  if (requests.length === 0) {
    return ctx.send("Заявок пока нет. Создать первую — /start");
  }
  const lines = requests.map((r) => {
    const time = r.scheduledAt ? format(r.scheduledAt, "d MMM, HH:mm", { locale: ru }) : "без даты";
    return `• <b>#${r.number}</b> · ${statusEmoji(r.status)} ${statusLabel(r.status)}\n  ${r.service?.name || "услуга"} · ${time}`;
  });
  await ctx.send(`<b>Ваши заявки:</b>\n\n${lines.join("\n\n")}`, {
    inlineKeyboard: [[{ text: "📝 Новая заявка", callbackData: "new_request" }]],
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// КЛИЕНТ — wizard новой заявки

async function startNewRequest(ctx: BotContext) {
  const services = await prisma.service.findMany({ orderBy: { name: "asc" } });
  await ctx.setState("new_request", "service", {});
  await ctx.send(
    "<b>Шаг 1 из 5</b> — какая услуга нужна?",
    {
      inlineKeyboard: [
        ...services.map((s) => [{ text: serviceEmoji(s.slug) + " " + s.name, callbackData: `svc:${s.id}` }]),
        [{ text: "✖️ Отмена", callbackData: "cancel_flow" }],
      ],
    },
  );
}

async function newRequestServicePicked(ctx: BotContext, serviceId: string) {
  const service = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!service) return;
  const data = ctx.state?.data || {};
  data.serviceId = service.id;
  data.serviceName = service.name;
  await ctx.setState("new_request", "cartridge", data);
  await ctx.send(
    `Выбрано: <b>${service.name}</b>\n\n<b>Шаг 2 из 5</b> — модель картриджа или принтера?\n\n` +
      `<i>Например: HP CF283A или Canon LBP6020. Если не знаете — напишите «не знаю».</i>`,
  );
}

async function newRequestCartridge(ctx: BotContext) {
  const data = ctx.state?.data || {};
  data.printerInfo = ctx.text;
  await ctx.setState("new_request", "when", data);
  const now = new Date();
  const tomorrow = addDays(now, 1);
  await ctx.send(
    "<b>Шаг 3 из 5</b> — когда вам удобно?",
    {
      inlineKeyboard: [
        [{ text: "📅 Сегодня", callbackData: `when:today` }],
        [{ text: `📅 Завтра (${format(tomorrow, "d MMM", { locale: ru })})`, callbackData: `when:tomorrow` }],
        [{ text: "🗓 На неделе — обсудим", callbackData: `when:week` }],
        [{ text: "✖️ Отмена", callbackData: "cancel_flow" }],
      ],
    },
  );
}

async function newRequestWhenPicked(ctx: BotContext, when: string) {
  const data = ctx.state?.data || {};
  if (when === "today") data.scheduledAt = setMinutes(setHours(new Date(), 16), 0).toISOString();
  else if (when === "tomorrow") data.scheduledAt = setMinutes(setHours(addDays(new Date(), 1), 10), 0).toISOString();
  else data.scheduledAt = null;
  data.whenChoice = when;
  await ctx.setState("new_request", "address", data);
  await ctx.send(
    "<b>Шаг 4 из 5</b> — куда приехать?\n\n<i>Напишите адрес: район, улица, дом, этаж/офис.</i>",
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
    const addr = await prisma.address.create({ data: { clientId: client.id, address: data.address } });
    addressId = addr.id;
  }

  // Номер заявки
  const last = await prisma.request.findFirst({ orderBy: { number: "desc" }, select: { number: true } });
  const request = await prisma.request.create({
    data: {
      number: (last?.number ?? 0) + 1,
      clientId: client.id,
      addressId,
      serviceId: data.serviceId || null,
      printerInfo: data.printerInfo === "не знаю" ? null : data.printerInfo,
      scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
      status: data.scheduledAt ? "SCHEDULED" : "NEW",
      source: "TELEGRAM",
      comment: data.whenChoice === "week" ? "Клиент готов обсудить дату" : null,
    },
    include: { service: true, address: true },
  });

  await ctx.clearState();
  await ctx.send(
    `✅ <b>Заявка #${request.number} принята</b>\n\n` +
      `Услуга: ${request.service?.name || "уточним"}\n` +
      (request.printerInfo ? `Картридж: ${request.printerInfo}\n` : "") +
      (request.address ? `Адрес: ${request.address.address}\n` : "") +
      (request.scheduledAt
        ? `Время: ${format(request.scheduledAt, "d MMMM, HH:mm", { locale: ru })}\n`
        : "Время: согласуем\n") +
      `\nМастер свяжется в ближайшее время.`,
    {
      inlineKeyboard: [[{ text: "📋 Все мои заявки", callbackData: "my_requests" }]],
    },
  );
  notifyAdminsNewRequest(request.id).catch((e) => console.error("[bot] admin notify failed", e));
}

async function continueNewRequest(ctx: BotContext) {
  const step = ctx.state?.step;
  if (step === "cartridge") return newRequestCartridge(ctx);
  if (step === "address") return newRequestAddress(ctx);
  if (step === "contact") return newRequestContactText(ctx);
  // Если на шаге service/when ждём callback — текст не понимаем
  await ctx.send("Воспользуйтесь кнопками выше или /cancel чтобы начать заново.");
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
        { status: { in: ["NEW", "EN_ROUTE", "IN_PROGRESS"] } },
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
      r.address?.address,
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
    const addr = await prisma.address.create({ data: { clientId: client.id, address: data.address } });
    addressId = addr.id;
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
  await ctx.send(
    `<b>${ctx.user.name}</b>\n\n` +
      `На сегодня: <b>${today}</b>\n` +
      `Новых без даты: <b>${newCount}</b>\n\n` +
      `/today — расписание на сегодня\n/next — следующая заявка`,
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
        { status: { in: ["IN_PROGRESS", "EN_ROUTE"] }, assignedToId: ctx.user.id },
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
    where: { assignedToId: ctx.user.id, status: { in: ["SCHEDULED", "EN_ROUTE", "IN_PROGRESS"] } },
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
  if (r.address) lines.push(`📍 ${r.address.address}`);
  if (r.printerInfo) lines.push(`🖨 ${r.printerInfo}`);
  if (r.comment) lines.push(`💬 ${r.comment}`);

  const buttons: any[] = [];
  if (r.status === "NEW" || r.status === "SCHEDULED") buttons.push({ text: "🚗 Выехать", callbackData: `req:${r.id}:enroute` });
  if (r.status === "EN_ROUTE") buttons.push({ text: "✅ Прибыл, начать", callbackData: `req:${r.id}:start` });
  if (r.status === "IN_PROGRESS") buttons.push({ text: "🏁 Завершить", callbackData: `req:${r.id}:done` });
  if (r.status === "AWAITING_PAYMENT") buttons.push({ text: "💰 Получена оплата", callbackData: `req:${r.id}:paid` });

  await ctx.send(lines.join("\n"), {
    inlineKeyboard: buttons.length ? [buttons] : undefined,
  });
}

async function masterRequestAction(ctx: BotContext, payload: string) {
  if (!ctx.user) return;
  const [id, action] = payload.split(":");

  // «Принять на себя» — назначает текущего сотрудника мастером и переводит в SCHEDULED
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
        ...(existing.status === "NEW" ? { status: "SCHEDULED" } : {}),
      },
    });
    return ctx.send(`✅ Взяли на себя заявку #${shortNumber(id)}. Дальше — /today.`);
  }

  const map: Record<string, string> = {
    enroute: "EN_ROUTE",
    start: "IN_PROGRESS",
    done: "AWAITING_PAYMENT",
    paid: "DONE",
  };
  const newStatus = map[action];
  if (!newStatus) return;
  const updated = await prisma.request.update({
    where: { id },
    data: {
      status: newStatus,
      ...(newStatus === "DONE" ? { paymentStatus: "PAID" } : {}),
      ...(newStatus === "IN_PROGRESS" ? { scheduledAt: new Date() } : {}),
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
    SCHEDULED: "Запланирована",
    EN_ROUTE: "Мастер в пути",
    IN_PROGRESS: "В работе",
    AWAITING_PAYMENT: "Ожидает оплаты",
    DONE: "Выполнена",
    CANCELLED: "Отменена",
  } as Record<string, string>)[s] || s;
}

function statusEmoji(s: string) {
  return ({
    NEW: "🆕",
    SCHEDULED: "📅",
    EN_ROUTE: "🚗",
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
