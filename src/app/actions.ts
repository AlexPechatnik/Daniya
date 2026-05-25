"use server";
import { prisma } from "@/lib/db";
import { normalizePhone } from "@/lib/utils";
import { enrichAddress } from "@/lib/districts";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { startOfDay } from "date-fns";
import { notifyAdminsNewLead, notifyAdminsNewRequest } from "@/lib/bot/notify";

const leadSchema = z.object({
  name: z.string().min(2, "Укажите имя"),
  phone: z.string().min(10, "Укажите телефон"),
  address: z.string().optional(),
  serviceKind: z.enum(["REFILL", "REPLACE", "DIAGNOSTIC", "REPAIR"]).optional(),
  // Для inkjet передаётся точный slug услуги (inkjet-diagnostics / head-cleaning / ...).
  // Если задан — приоритетнее serviceKind при привязке Service к заявке.
  serviceSlug: z.string().optional(),
  printer: z.string().optional(),
  cartridge: z.string().optional(),
  comment: z.string().optional(),
});

export type LeadFormState = { ok?: boolean; error?: string; fields?: Record<string, string> };

export async function submitLead(_prev: LeadFormState, formData: FormData): Promise<LeadFormState> {
  const data = {
    name: String(formData.get("name") || ""),
    phone: String(formData.get("phone") || ""),
    address: String(formData.get("address") || "") || undefined,
    serviceKind: (formData.get("serviceKind") as string) || undefined,
    serviceSlug: String(formData.get("serviceSlug") || "") || undefined,
    printer: String(formData.get("printer") || "") || undefined,
    cartridge: String(formData.get("cartridge") || "") || undefined,
    comment: String(formData.get("comment") || "") || undefined,
  };
  const parsed = leadSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message || "Проверьте поля" };
  }

  const phone = normalizePhone(parsed.data.phone);

  // Находим или создаём клиента — раньше для нового клиента создавался
  // RequestLead, который нигде в CRM не показывался. Теперь всегда Request.
  let client = await prisma.client.findUnique({ where: { phone } });
  if (!client) {
    client = await prisma.client.create({
      data: { name: parsed.data.name, phone },
    });
  }

  // Привязываем сервис. Приоритет — точный slug (для inkjet это inkjet-diagnostics
  // и т.п.), иначе мапим общий kind (REFILL/REPLACE/DIAGNOSTIC/REPAIR) на slug.
  let serviceId: string | null = null;
  if (parsed.data.serviceSlug) {
    const service = await prisma.service.findUnique({ where: { slug: parsed.data.serviceSlug } });
    serviceId = service?.id || null;
  }
  if (!serviceId && parsed.data.serviceKind) {
    const slugMap: Record<string, string> = {
      REFILL: "zapravka",
      REPLACE: "zamena",
      DIAGNOSTIC: "diagnostika",
      REPAIR: "remont",
    };
    const slug = slugMap[parsed.data.serviceKind];
    if (slug) {
      const service = await prisma.service.findUnique({ where: { slug } });
      serviceId = service?.id || null;
    }
  }

  let addressId: string | undefined;
  if (parsed.data.address) {
    const addr = await prisma.address.create({
      data: { clientId: client.id, ...(await enrichAddress(parsed.data.address)) },
    });
    addressId = addr.id;
  }

  // Если клиент указал и принтер, и картридж — храним оба в printerInfo для мастера.
  // Если только что-то одно — пишем его как есть.
  const printerInfoParts: string[] = [];
  if (parsed.data.printer) printerInfoParts.push(`Принтер: ${parsed.data.printer}`);
  if (parsed.data.cartridge) printerInfoParts.push(`Картридж: ${parsed.data.cartridge}`);
  const printerInfo = printerInfoParts.length > 0 ? printerInfoParts.join(" · ") : undefined;

  // Сохраняем модель принтера в каталог клиента — пригодится при повторных заявках.
  if (parsed.data.printer) {
    const [brand, ...rest] = parsed.data.printer.trim().split(/\s+/);
    const model = rest.join(" ");
    if (brand && model) {
      await prisma.printer.create({
        data: { clientId: client.id, brand, model },
      }).catch(() => undefined);
    }
  }

  // Если в форме указан картридж и он есть в нашем каталоге — линкуем его к заявке.
  let cartridgeId: string | null = null;
  if (parsed.data.cartridge) {
    const raw = parsed.data.cartridge.trim();
    const [maybeBrand, ...rest] = raw.split(/\s+/);
    const tryModel = rest.join(" ") || maybeBrand;
    const tryBrand = rest.length > 0 ? maybeBrand : undefined;
    const cart = await prisma.cartridge.findFirst({
      where: tryBrand
        ? { brand: { contains: tryBrand }, model: { contains: tryModel } }
        : { model: { contains: tryModel } },
    });
    if (cart) cartridgeId = cart.id;
  }

  const last = await prisma.request.findFirst({ orderBy: { number: "desc" }, select: { number: true } });
  const request = await prisma.request.create({
    data: {
      number: (last?.number ?? 0) + 1,
      clientId: client.id,
      addressId,
      serviceId,
      cartridgeId,
      source: "WEB",
      status: "NEW",
      printerInfo,
      comment: parsed.data.comment,
    },
  });
  notifyAdminsNewRequest(request.id).catch((e) => console.error("[lead] admin notify failed", e));

  // Старый RequestLead больше не создаём — оставляем модель, чтобы не ломать историю,
  // но новые заявки идут сразу в Request.
  void notifyAdminsNewLead; // helper остаётся для совместимости

  revalidatePath("/crm");
  return { ok: true };
}

/**
 * Список нерабочих дней на ближайшие 90 дней — для подсказки в публичной форме.
 */
export async function getUpcomingHolidays() {
  const now = startOfDay(new Date());
  const future = new Date(now);
  future.setDate(future.getDate() + 90);
  const items = await prisma.holiday.findMany({
    where: { date: { gte: now, lte: future } },
    orderBy: { date: "asc" },
  });
  return items.map((h) => ({ date: h.date.toISOString().slice(0, 10), reason: h.reason || "Выходной" }));
}

export async function calculateEstimate(serviceId: string, cartridgeId: string | null, quantity: number) {
  const price = await prisma.price.findFirst({
    where: { serviceId, cartridgeId: cartridgeId ?? undefined },
  });
  const fallback = !price
    ? await prisma.price.findFirst({ where: { serviceId, cartridgeId: null } })
    : null;
  const p = price ?? fallback;
  return { amount: (p?.amount ?? 0) * quantity, found: !!price };
}
