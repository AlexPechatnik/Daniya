import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

/**
 * PATCH /api/price/[id]  Body: { amount?: number /* в рублях *\/, note?: string }
 * DELETE /api/price/[id]
 *
 * Используется для inline-редактирования цен прямо в CRM-таблице,
 * без выгрузки/загрузки Excel.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const body = await req.json();

  const data: any = {};
  if (typeof body.amount === "number" && Number.isFinite(body.amount)) {
    data.amount = Math.round(body.amount * 100);
  }
  if (typeof body.note === "string") {
    data.note = body.note || null;
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Нет полей для обновления" }, { status: 400 });
  }

  const updated = await prisma.price.update({ where: { id }, data });
  return NextResponse.json({ ok: true, price: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  await prisma.price.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
