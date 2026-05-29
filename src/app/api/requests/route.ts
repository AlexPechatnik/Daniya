import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { normalizePhone } from "@/lib/utils";
import { enrichAddress } from "@/lib/districts";

export async function POST(req: NextRequest) {
  await requireUser();
  const body = await req.json();
  const phone = normalizePhone(body.phone || "");

  let clientId: string | undefined = body.clientId;
  let addressId: string | undefined = body.addressId;

  if (!clientId) {
    const existing = await prisma.client.findUnique({ where: { phone } });
    if (existing) {
      clientId = existing.id;
    } else {
      // Если имя не указано — генерируем из телефона (мастер уточнит при перезвоне)
      const fallbackName = `Клиент ${phone}`;
      const created = await prisma.client.create({
        data: { name: body.name?.trim() || fallbackName, phone },
      });
      clientId = created.id;
    }
  }

  if (!addressId && body.address) {
    const addr = await prisma.address.create({
      data: { clientId: clientId!, ...(await enrichAddress(body.address)) },
    });
    addressId = addr.id;
  }

  // Предварительная стоимость:
  // 1) если в printerInfo узнаётся конкретный картридж (бренд/модель) — берём
  //    цену для пары (service, cartridge);
  // 2) иначе — базовую цену услуги (Price с cartridgeId = null).
  // Мастер может потом скорректировать вручную, но «по умолчанию ноль»
  // съедало время и заставляло каждый раз думать о прайсе.
  let price: number | null = null;
  if (body.serviceId) {
    const printerInfo = String(body.printerInfo || "").trim();
    if (printerInfo) {
      const cart = await prisma.cartridge.findFirst({
        where: {
          OR: [
            { model: { contains: printerInfo } },
            { compatible: { contains: printerInfo } },
          ],
        },
        select: { id: true },
      });
      if (cart) {
        const exact = await prisma.price.findFirst({
          where: { serviceId: body.serviceId, cartridgeId: cart.id },
        });
        if (exact) price = exact.amount;
      }
    }
    if (price == null) {
      const base = await prisma.price.findFirst({
        where: { serviceId: body.serviceId, cartridgeId: null },
      });
      if (base) price = base.amount;
    }
  }

  const last = await prisma.request.findFirst({ orderBy: { number: "desc" }, select: { number: true } });
  const request = await prisma.request.create({
    data: {
      number: (last?.number ?? 0) + 1,
      clientId: clientId!,
      addressId,
      serviceId: body.serviceId || null,
      assignedToId: body.assignedToId || null,
      scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
      printerInfo: body.printerInfo || null,
      price,
      comment: body.comment || null,
      status: body.scheduledAt ? "SCHEDULED" : "NEW",
      source: "PHONE",
    },
  });

  return NextResponse.json({ ok: true, id: request.id });
}

export async function PATCH(req: NextRequest) {
  await requireUser();
  const body = await req.json();
  const { id, ...patch } = body;

  if ("address" in patch) {
    const address = String(patch.address || "").trim();
    delete patch.address;

    const current = await prisma.request.findUnique({
      where: { id },
      select: { clientId: true, addressId: true },
    });
    if (!current) return NextResponse.json({ error: "Заявка не найдена" }, { status: 404 });

    if (address) {
      if (current.addressId) {
        await prisma.address.update({
          where: { id: current.addressId },
          data: await enrichAddress(address),
        });
        patch.addressId = current.addressId;
      } else {
        const created = await prisma.address.create({
          data: { clientId: current.clientId, ...(await enrichAddress(address)) },
        });
        patch.addressId = created.id;
      }
    } else {
      patch.addressId = null;
    }
  }

  if (patch.scheduledAt) patch.scheduledAt = new Date(patch.scheduledAt);
  const updated = await prisma.request.update({ where: { id }, data: patch });
  return NextResponse.json({ ok: true, request: updated });
}
