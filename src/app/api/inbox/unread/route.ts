import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

/**
 * GET /api/inbox/unread — лёгкий счётчик непрочитанных входящих.
 * Нужен для polling-а из ChatSidebar, когда панель свёрнута, — не таскать
 * каждые 30 секунд весь список диалогов ради одного числа.
 *
 * Ответ: { total: number }
 */
export async function GET() {
  await requireUser();
  const total = await prisma.message.count({
    where: { direction: "in", unread: true },
  });
  return NextResponse.json({ total });
}
