import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { sendToClient } from "@/lib/messengers";

/**
 * POST /api/messages/send
 * Body: { clientId, text, provider? }
 *
 * Отправляет сообщение клиенту через первый подходящий привязанный канал.
 * Если provider указан — используем именно его. Сохраняет out-сообщение в БД.
 */
export async function POST(req: NextRequest) {
  await requireUser();
  const { clientId, text, provider } = await req.json();

  if (!clientId || !text?.trim()) {
    return NextResponse.json({ error: "clientId и text обязательны" }, { status: 400 });
  }

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: { channels: true },
  });
  if (!client) return NextResponse.json({ error: "Клиент не найден" }, { status: 404 });

  if (client.channels.length === 0) {
    return NextResponse.json(
      { error: "У клиента нет привязанных мессенджеров. Позвоните по телефону." },
      { status: 400 },
    );
  }

  // sendToClient внутри сам выбирает первый рабочий канал и сохраняет out-Message.
  // Если provider передан — фильтруем перед вызовом.
  let usedProvider: string | null = null;
  if (provider) {
    const channel = client.channels.find((c) => c.provider === provider);
    if (!channel) {
      return NextResponse.json({ error: `Клиент не привязан к ${provider}` }, { status: 400 });
    }
  }

  usedProvider = await sendToClient(clientId, text.trim());
  if (!usedProvider) {
    return NextResponse.json(
      { error: "Не удалось доставить сообщение. Проверьте статус ботов." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, provider: usedProvider });
}
