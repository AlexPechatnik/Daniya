import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

/**
 * GET /api/inbox — список диалогов с клиентами для общего ящика входящих.
 * Возвращает каждого клиента, у которого есть хотя бы одно сообщение,
 * с превью последнего сообщения, временем и количеством непрочитанных.
 */
export async function GET() {
  await requireUser();

  // Берём всех клиентов с хотя бы одним сообщением.
  // SQLite не даёт нормально сделать distinct, поэтому идём через GroupBy.
  const grouped = await prisma.message.groupBy({
    by: ["clientId"],
    _max: { createdAt: true },
    _count: { _all: true },
  });

  // Считаем непрочитанные отдельно (только direction='in')
  const unreadByClient = await prisma.message.groupBy({
    by: ["clientId"],
    where: { direction: "in", unread: true },
    _count: { _all: true },
  });
  const unreadMap = new Map(unreadByClient.map((g) => [g.clientId, g._count._all]));

  // Загружаем клиентов
  const clients = await prisma.client.findMany({
    where: { id: { in: grouped.map((g) => g.clientId) } },
    include: {
      channels: true,
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  // Сортируем по времени последнего сообщения убыванию
  const sorted = clients
    .map((c) => {
      const last = c.messages[0];
      return {
        clientId: c.id,
        clientName: c.name,
        clientPhone: c.phone,
        lastText: last?.text ?? "",
        lastDirection: last?.direction ?? "in",
        lastProvider: last?.provider ?? null,
        lastAt: last?.createdAt?.toISOString() ?? null,
        unread: unreadMap.get(c.id) || 0,
        totalMessages: grouped.find((g) => g.clientId === c.id)?._count._all || 0,
        providers: Array.from(new Set(c.channels.map((ch) => ch.provider))),
      };
    })
    .sort((a, b) => (b.lastAt || "").localeCompare(a.lastAt || ""));

  const totalUnread = unreadByClient.reduce((s, g) => s + g._count._all, 0);

  return NextResponse.json({ conversations: sorted, totalUnread });
}
