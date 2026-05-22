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
    cartridge: String(formData.get("cartridge") || "") || undefined,
    comment: String(formData.get("comment") || "") || undefined,
  };
  const parsed = leadSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message || "Проверьте поля" };
  }

  const phone = normalizePhone(parsed.data.phone);

  // Если клиент уже есть — создаём заявку сразу
  const existing = await prisma.client.findUnique({ where: { phone } });
  if (existing) {
    let addressId: string | undefined;
    if (parsed.data.address) {
      const addr = await prisma.address.create({
        data: { clientId: existing.id, ...(await enrichAddress(parsed.data.address)) },
      });
      addressId = addr.id;
    }
    const last = await prisma.request.findFirst({ orderBy: { number: "desc" }, select: { number: true } });
    const request = await prisma.request.create({
      data: {
        number: (last?.number ?? 0) + 1,
        clientId: existing.id,
        addressId,
        source: "WEB",
        status: "NEW",
        printerInfo: parsed.data.cartridge,
        comment: parsed.data.comment,
      },
    });
    notifyAdminsNewRequest(request.id).catch((e) => console.error("[lead] admin notify failed", e));
  } else {
    const lead = await prisma.requestLead.create({
      data: {
        name: parsed.data.name,
        phone,
        address: parsed.data.address,
        serviceKind: parsed.data.serviceKind,
        cartridge: parsed.data.cartridge,
        comment: parsed.data.comment,
      },
    });
    notifyAdminsNewLead(lead.id).catch((e) => console.error("[lead] admin notify failed", e));
  }

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
