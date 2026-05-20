import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getAdapter } from "@/lib/messengers";
import { randomBytes } from "node:crypto";

/**
 * POST /api/bot/pair/start
 * Body: { userId, provider } — provider: TELEGRAM | MAX
 *
 * Создаёт одноразовый pairing-токен на 15 минут.
 * Возвращает deep-link, который сотрудник открывает в мессенджере: бот сам привяжет его chat_id.
 */
export async function POST(req: NextRequest) {
  await requireAdmin();
  const { userId, provider } = await req.json();
  if (!userId) return NextResponse.json({ error: "userId обязателен" }, { status: 400 });
  const upper = String(provider || "TELEGRAM").toUpperCase();
  if (upper !== "TELEGRAM" && upper !== "MAX") {
    return NextResponse.json({ error: "Неизвестный provider" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return NextResponse.json({ error: "Сотрудник не найден" }, { status: 404 });

  // Удалим старые неиспользованные токены этого юзера/провайдера
  await prisma.pairingToken.deleteMany({
    where: { userId, provider: upper, usedAt: null },
  });

  const token = randomBytes(6).toString("hex").toUpperCase();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  await prisma.pairingToken.create({
    data: { userId, provider: upper, token, expiresAt },
  });

  // Сборка deep-link
  let link: string | null = null;
  if (upper === "TELEGRAM") {
    const adapter = getAdapter("TELEGRAM");
    const me = adapter?.enabled && adapter.getMe ? await adapter.getMe() : null;
    if (me?.username) {
      link = `https://t.me/${me.username}?start=PAIR-${token}`;
    }
  }

  return NextResponse.json({
    ok: true,
    token,
    expiresAt: expiresAt.toISOString(),
    link,
    instruction: link
      ? "Откройте ссылку в Telegram. Бот привяжет ваш chat id автоматически."
      : "Напишите боту: /start PAIR-" + token,
  });
}
