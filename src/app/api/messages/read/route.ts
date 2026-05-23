import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

/**
 * POST /api/messages/read
 * Body: { clientId }  — пометить все непрочитанные входящие этого клиента
 * прочитанными.
 */
export async function POST(req: NextRequest) {
  await requireUser();
  const { clientId } = await req.json();
  if (!clientId) return NextResponse.json({ error: "clientId обязателен" }, { status: 400 });

  const result = await prisma.message.updateMany({
    where: { clientId, direction: "in", unread: true },
    data: { unread: false },
  });

  return NextResponse.json({ ok: true, marked: result.count });
}
