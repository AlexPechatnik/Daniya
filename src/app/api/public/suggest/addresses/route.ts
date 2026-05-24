import { NextRequest, NextResponse } from "next/server";
import { suggestYandexAddresses } from "@/lib/geocoder";

/**
 * Публичный (без авторизации) endpoint автокомплита адресов — для формы
 * заявки на сайте. В отличие от /api/suggest/addresses, не возвращает
 * сохранённые CRM-адреса (приватность других клиентов), только Яндекс.
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() || "";
  if (q.length < 3) return NextResponse.json({ suggestions: [] });

  const yandex = await suggestYandexAddresses(q, 8);
  const suggestions = yandex.map((a) => ({
    value: a.value,
    title: a.title,
    subtitle: a.subtitle,
    kind: undefined, // в публичной форме без бейджа «Карта/CRM»
  }));

  return NextResponse.json({ suggestions });
}
