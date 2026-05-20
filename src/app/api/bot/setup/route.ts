import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getAdapter } from "@/lib/messengers";

/**
 * POST /api/bot/setup — регистрирует webhook у Telegram.
 * Принимает: { provider, baseUrl } — baseUrl это публичный https адрес сайта.
 */
export async function POST(req: NextRequest) {
  await requireUser();
  const { provider, baseUrl } = await req.json();
  const adapter = getAdapter(provider);
  if (!adapter?.enabled) return NextResponse.json({ error: "Адаптер не настроен (нет токена в .env)" }, { status: 400 });
  if (!adapter.setWebhook) return NextResponse.json({ error: "Провайдер не поддерживает setWebhook" }, { status: 400 });

  const base = (baseUrl || process.env.PUBLIC_BASE_URL || "").trim().replace(/\/+$/, "");
  if (!base || !/^https:\/\//i.test(base)) {
    return NextResponse.json({ error: "Нужен публичный HTTPS-адрес (например, ngrok)" }, { status: 400 });
  }
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET || undefined;
  const url = `${base}/api/messenger/${String(provider).toLowerCase()}/webhook`;
  const result = await adapter.setWebhook(url, secret);
  return NextResponse.json({ ok: result.ok, url, description: result.description });
}
