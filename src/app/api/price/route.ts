import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

/**
 * POST /api/price — создать строку прайса вручную из CRM.
 * Body: { serviceSlug, amount (₽), brand?, model?, note? }
 *
 * Если указаны brand+model — связываем (или создаём) картридж.
 * Если уже есть Price (serviceId, cartridgeId) — обновляем (PATCH-семантика).
 */
export async function POST(req: NextRequest) {
  await requireAdmin();
  const body = await req.json();
  const { serviceSlug, amount, brand, model, note } = body || {};

  if (!serviceSlug || typeof amount !== "number" || !Number.isFinite(amount)) {
    return NextResponse.json({ error: "Нужны serviceSlug и amount" }, { status: 400 });
  }

  const service = await prisma.service.findUnique({ where: { slug: serviceSlug } });
  if (!service) return NextResponse.json({ error: `Услуга ${serviceSlug} не найдена` }, { status: 400 });

  let cartridgeId: string | null = null;
  if (brand && model) {
    const cartridgeType = service.kind.startsWith("INKJET") || service.slug === "chernila" ? "струйный" : "лазерный";
    const cart = await prisma.cartridge.upsert({
      where: { brand_model: { brand: String(brand).trim(), model: String(model).trim() } },
      create: { brand: String(brand).trim(), model: String(model).trim(), type: cartridgeType },
      update: {},
    });
    cartridgeId = cart.id;
  }

  // Если такая связка уже есть — обновляем, иначе создаём.
  const existing = await prisma.price.findFirst({ where: { serviceId: service.id, cartridgeId } });
  const saved = existing
    ? await prisma.price.update({
        where: { id: existing.id },
        data: { amount: Math.round(amount * 100), note: note || null },
      })
    : await prisma.price.create({
        data: { serviceId: service.id, cartridgeId, amount: Math.round(amount * 100), note: note || null },
      });

  return NextResponse.json({ ok: true, price: saved, mode: existing ? "updated" : "created" });
}
