import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { normalizeDay } from "@/lib/holidays";

export async function GET(req: NextRequest) {
  await requireUser();
  const sp = req.nextUrl.searchParams;
  const from = sp.get("from") ? new Date(sp.get("from")!) : new Date(new Date().getFullYear(), 0, 1);
  const to = sp.get("to") ? new Date(sp.get("to")!) : new Date(new Date().getFullYear() + 1, 0, 1);
  const items = await prisma.holiday.findMany({
    where: { date: { gte: from, lte: to } },
    orderBy: { date: "asc" },
  });
  return NextResponse.json({ holidays: items });
}

export async function POST(req: NextRequest) {
  await requireUser();
  const { date, reason, userId } = await req.json();
  const day = normalizeDay(new Date(date));
  try {
    const created = await prisma.holiday.create({
      data: { date: day, reason: reason || "Выходной", userId: userId || null },
    });
    return NextResponse.json({ ok: true, holiday: created });
  } catch (e: any) {
    return NextResponse.json({ error: "Этот день уже отмечен" }, { status: 409 });
  }
}

export async function DELETE(req: NextRequest) {
  await requireUser();
  const sp = req.nextUrl.searchParams;
  const id = sp.get("id");
  const date = sp.get("date");
  if (id) {
    await prisma.holiday.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  }
  if (date) {
    const day = normalizeDay(new Date(date));
    await prisma.holiday.deleteMany({ where: { date: day } });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "id или date обязателен" }, { status: 400 });
}
