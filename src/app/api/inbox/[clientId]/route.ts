import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

/**
 * GET /api/inbox/[clientId] — открыть диалог: история + контекст клиента.
 * Также автоматически помечает все входящие как прочитанные.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ clientId: string }> }) {
  await requireUser();
  const { clientId } = await params;

  // Помечаем непрочитанные как прочитанные
  await prisma.message.updateMany({
    where: { clientId, direction: "in", unread: true },
    data: { unread: false },
  });

  const [client, messages] = await Promise.all([
    prisma.client.findUnique({
      where: { id: clientId },
      include: {
        addresses: true,
        channels: true,
        requests: {
          orderBy: { createdAt: "desc" },
          take: 5,
          include: { service: true },
        },
      },
    }),
    prisma.message.findMany({
      where: { clientId },
      orderBy: { createdAt: "asc" },
      take: 200,
    }),
  ]);

  if (!client) return NextResponse.json({ error: "Не найден" }, { status: 404 });

  return NextResponse.json({
    client: {
      id: client.id,
      name: client.name,
      org: client.org,
      phone: client.phone,
      email: client.email,
      notes: client.notes,
      addresses: client.addresses,
      channels: client.channels,
      recentRequests: client.requests.map((r) => ({
        id: r.id,
        number: r.number,
        status: r.status,
        serviceName: r.service?.name || null,
        scheduledAt: r.scheduledAt?.toISOString() || null,
        price: r.price,
      })),
    },
    messages: messages.map((m) => ({
      id: m.id,
      direction: m.direction,
      text: m.text,
      provider: m.provider,
      createdAt: m.createdAt.toISOString(),
      requestId: m.requestId,
    })),
  });
}
