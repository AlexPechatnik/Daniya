import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { normalizePhone } from "@/lib/utils";
import { withDistrict } from "@/lib/districts";

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
      data: { clientId: clientId!, ...withDistrict(body.address) },
    });
    addressId = addr.id;
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
  if (patch.scheduledAt) patch.scheduledAt = new Date(patch.scheduledAt);
  const updated = await prisma.request.update({ where: { id }, data: patch });
  return NextResponse.json({ ok: true, request: updated });
}
