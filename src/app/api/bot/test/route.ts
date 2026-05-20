import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getAdapter } from "@/lib/messengers";

/**
 * POST /api/bot/test — отправить тестовое сообщение себе.
 * Принимает: { provider, externalId, text }
 */
export async function POST(req: NextRequest) {
  await requireUser();
  const { provider, externalId, text } = await req.json();
  const adapter = getAdapter(provider);
  if (!adapter?.enabled) return NextResponse.json({ error: "Адаптер не настроен" }, { status: 400 });
  if (!externalId) return NextResponse.json({ error: "Укажите chat_id" }, { status: 400 });

  try {
    await adapter.sendMessage(String(externalId), text || "👋 Тестовое сообщение от CRM.");
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Ошибка отправки" }, { status: 500 });
  }
}
