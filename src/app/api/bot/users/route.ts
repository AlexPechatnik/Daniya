import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

interface UserBotBinding {
  id: string;
  telegramId?: string | null;
  maxId?: string | null;
}

export async function PATCH(req: NextRequest) {
  await requireAdmin();
  const body = await req.json().catch(() => ({}));
  const users = Array.isArray(body.users) ? body.users as UserBotBinding[] : [];

  try {
    await prisma.$transaction(
      users.map((user) =>
        prisma.user.update({
          where: { id: user.id },
          data: {
            telegramId: normalizeChatId(user.telegramId),
            maxId: normalizeChatId(user.maxId),
          },
        }),
      ),
    );
  } catch (e: any) {
    if (e?.code === "P2002") {
      return NextResponse.json({ error: "Этот chat id уже привязан к другому сотруднику" }, { status: 409 });
    }
    console.error("[bot/users] save failed", e);
    return NextResponse.json({ error: "Не удалось сохранить сотрудников" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

function normalizeChatId(value?: string | null) {
  const text = String(value ?? "").trim();
  return text || null;
}
