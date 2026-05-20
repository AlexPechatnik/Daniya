import { NextRequest, NextResponse } from "next/server";
import { getAdapter } from "@/lib/messengers";
import { dispatch } from "@/lib/bot/runner";
import type { MessengerProvider } from "@/lib/messengers/types";

/**
 * Универсальный webhook для всех мессенджеров.
 * URL: /api/messenger/telegram/webhook  /  /api/messenger/max/webhook
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const upper = provider.toUpperCase() as MessengerProvider;
  const adapter = getAdapter(upper);
  if (!adapter) return NextResponse.json({ error: "Unknown provider" }, { status: 404 });
  if (!adapter.enabled) return NextResponse.json({ ok: true, note: "Provider not configured" });

  const body = await req.json().catch(() => null);
  const event = await adapter.parseWebhook(body, req.headers);
  if (!event) return NextResponse.json({ ok: true });

  // Запускаем диспетчер в фоне — Telegram не любит долгих ответов на webhook
  dispatch(event).catch((e) => console.error("[webhook dispatch]", e));
  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({ ok: true, hint: "POST webhook here" });
}
