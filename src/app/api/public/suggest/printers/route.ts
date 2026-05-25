import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * Публичный автокомплит моделей принтеров для формы заявки.
 * GET /api/public/suggest/printers?q=m404
 *
 * Ответ:
 *   { suggestions: [{ value, title, subtitle, kind }] }
 *
 * value = "Бренд Семейство" — то, что подставится в input.
 * subtitle = подходящие картриджи через запятую — клиент сразу видит, что подойдёт.
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() || "";
  if (q.length < 2) return NextResponse.json({ suggestions: [] });

  // SQLite не умеет ILIKE, contains в Prisma эквивалентен LIKE %q%.
  // Ищем по brand, family и aliases (JSON в виде строки).
  const found = await prisma.printerModel.findMany({
    where: {
      OR: [
        { family: { contains: q } },
        { brand: { contains: q } },
        { aliases: { contains: q } },
      ],
    },
    include: { cartridges: { include: { cartridge: true } } },
    orderBy: [{ demand: "asc" }, { family: "asc" }],
    take: 10,
  });

  const suggestions = found.map((p) => {
    const carts = p.cartridges.map((c) => c.cartridge.model);
    return {
      value: `${p.brand} ${p.family}`,
      title: `${p.brand} ${p.family}`,
      subtitle: carts.length > 0
        ? `Картриджи: ${carts.slice(0, 3).join(", ")}${carts.length > 3 ? "…" : ""}`
        : p.kind || undefined,
      kind: p.demand ? `Топ ${p.demand}` : undefined,
    };
  });

  return NextResponse.json({ suggestions });
}
