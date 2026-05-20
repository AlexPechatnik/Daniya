import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { nextAction, type RequestStatus } from "@/lib/status";
import { notifyClientStatusChange } from "@/lib/bot/notify";

/**
 * POST /api/requests/[id]/transition
 * Body: { to?: RequestStatus, cancel?: true }
 * Если to не указан — движется на следующий статус по pipeline.
 * Дополнительно может переключать paymentStatus при переходе AWAITING_PAYMENT → DONE.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const current = await prisma.request.findUnique({ where: { id } });
  if (!current) return NextResponse.json({ error: "Заявка не найдена" }, { status: 404 });

  let to: RequestStatus | undefined = body.to;
  if (body.cancel) to = "CANCELLED";
  if (!to) {
    const na = nextAction(current.status as RequestStatus);
    if (!na) return NextResponse.json({ error: "Нет следующего шага" }, { status: 400 });
    to = na.next;
  }

  const data: any = { status: to };
  // При переходе в AWAITING_PAYMENT, если ещё не оплачено — оставляем как есть.
  // При переходе в DONE — фиксируем оплату.
  if (to === "DONE" && current.paymentStatus !== "PAID") {
    data.paymentStatus = "PAID";
  }
  // При IN_PROGRESS, если scheduledAt не было — ставим сейчас.
  if (to === "IN_PROGRESS" && !current.scheduledAt) {
    data.scheduledAt = new Date();
  }

  const updated = await prisma.request.update({ where: { id }, data });

  // Уведомление клиенту — не дожидаемся, чтобы не задерживать ответ
  notifyClientStatusChange(updated.id, updated.status).catch((e) =>
    console.error("[transition] notify failed", e),
  );

  return NextResponse.json({ ok: true, request: updated });
}
