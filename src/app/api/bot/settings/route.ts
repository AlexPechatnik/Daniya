import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { requireAdmin } from "@/lib/auth";

const EDITABLE_KEYS = [
  "PUBLIC_BASE_URL",
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_WEBHOOK_SECRET",
  "TELEGRAM_ADMIN_CHAT_ID",
  "MAX_BOT_TOKEN",
  "MAX_WEBHOOK_SECRET",
  "MAX_ADMIN_CHAT_ID",
  // Публичные — видны в браузере, нужны для кнопок «Написать в бот» на сайте.
  "NEXT_PUBLIC_TELEGRAM_BOT_USERNAME",
  "NEXT_PUBLIC_TELEGRAM_BOT_URL",
  "NEXT_PUBLIC_MAX_BOT_USERNAME",
  "NEXT_PUBLIC_MAX_BOT_URL",
  // Геокодер
  "YANDEX_GEOCODER_KEY",
] as const;

type EditableKey = (typeof EDITABLE_KEYS)[number];

export async function POST(req: NextRequest) {
  await requireAdmin();
  const body = await req.json().catch(() => ({}));
  const envPath = path.join(process.cwd(), ".env");
  const current = await fs.readFile(envPath, "utf8").catch(() => "");
  const values = parseEnv(current);

  const rejected: string[] = [];
  for (const key of EDITABLE_KEYS) {
    if (!(key in body)) continue;
    const value = String(body[key] ?? "").trim();
    // Не затираем уже заданные токены/секреты пустой строкой
    if (isTokenKey(key) && !value) continue;
    // Защита от случайного ввода: токен должен выглядеть как токен, а не пароль
    if (key === "TELEGRAM_BOT_TOKEN" && value && !/^\d{8,12}:[A-Za-z0-9_-]{20,}$/.test(value)) {
      rejected.push(`TELEGRAM_BOT_TOKEN: не похож на токен Telegram (должен быть вида 12345:ABC...)`);
      continue;
    }
    if (key === "MAX_BOT_TOKEN" && value && value.length < 20) {
      rejected.push(`MAX_BOT_TOKEN: слишком короткий, проверьте значение`);
      continue;
    }
    values[key] = value;
  }

  await fs.writeFile(envPath, stringifyEnv(current, values), "utf8");
  if (rejected.length) {
    return NextResponse.json({ ok: false, rejected }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

function isTokenKey(key: EditableKey) {
  return key.endsWith("_BOT_TOKEN") || key.endsWith("_WEBHOOK_SECRET");
}

function parseEnv(content: string) {
  const values: Record<string, string> = {};
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    values[match[1]] = unquote(match[2]);
  }
  return values;
}

function stringifyEnv(original: string, values: Record<string, string>) {
  const seen = new Set<string>();
  const lines = original.split(/\r?\n/).map((line) => {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=/);
    if (!match) return line;
    const key = match[1];
    if (!(key in values)) return line;
    seen.add(key);
    return `${key}=${JSON.stringify(values[key] ?? "")}`;
  });

  for (const key of EDITABLE_KEYS) {
    if (!seen.has(key) && values[key]) lines.push(`${key}=${JSON.stringify(values[key])}`);
  }

  return lines.join("\n").replace(/\n*$/, "\n");
}

function unquote(value: string) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}
