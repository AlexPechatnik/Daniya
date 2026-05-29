import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

/**
 * Лента «свежих заявок от клиентов» для всплывающего уведомления в CRM.
 * Берём только то, что создал клиент сам (через Telegram / MAX / web),
 * а не админ через QuickAddModal (source: PHONE). Иначе админ бы сам себе
 * слал нотификацию о собственной только что созданной заявке.
 *
 *   GET ?since=<ISO>   — что появилось после этого момента
 *   GET (без since)    — последние 10 за последний час (стартовая загрузка)
 */
export async function GET(req: NextRequest) {
  await requireUser();
  const since = req.nextUrl.searchParams.get("since");
  const sinceDate = since ? new Date(since) : new Date(Date.now() - 60 * 60 * 1000);

  const rows = await prisma.request.findMany({
    where: {
      createdAt: { gt: sinceDate },
      source: { in: ["TELEGRAM", "MAX", "WEB"] },
      // Покажем все статусы — если клиент создал и кто-то успел перевести
      // в SCHEDULED, нотификация всё равно важна. Главное — что новое.
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: {
      client: { select: { name: true, phone: true } },
      service: { select: { name: true } },
    },
  });

  return NextResponse.json({
    requests: rows.map((r) => ({
      id: r.id,
      number: r.number,
      clientName: r.client.name,
      clientPhone: r.client.phone,
      serviceName: r.service?.name || "Услуга не выбрана",
      source: r.source,
      createdAt: r.createdAt.toISOString(),
    })),
    serverTime: new Date().toISOString(),
  });
}
