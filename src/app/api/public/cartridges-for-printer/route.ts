import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/public/cartridges-for-printer?q=HP+LaserJet+M404dn
 *
 * Клиент не знает картридж — пишет модель принтера. Мы возвращаем
 * подходящие картриджи из каталога (по совпадению brand/family/aliases).
 *
 * Ответ:
 *   { printer: { brand, family, kind } | null,
 *     cartridges: [{ brand, model, hasChip }] }
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() || "";
  if (q.length < 2) return NextResponse.json({ printer: null, cartridges: [] });

  // Разбиваем запрос на токены и ищем по каждому из них (поэтому работает
  // «HP M404», «LaserJet M404», «Pantum P2200» — даже если family хранится как
  // «LaserJet Pro M404dn»).
  const tokens = q.split(/\s+/).filter((t) => t.length >= 2);
  // Сначала пробуем «самый длинный» токен — чаще всего это модель.
  tokens.sort((a, b) => b.length - a.length);

  // Используем any — Prisma не выводит include-связи через переменную с findFirst в цикле.
  let printer: any = null;
  for (const t of tokens) {
    printer = await prisma.printerModel.findFirst({
      where: {
        OR: [
          { family: { contains: t } },
          { aliases: { contains: t } },
        ],
      },
      include: { cartridges: { include: { cartridge: true } } },
      orderBy: [{ demand: "asc" }],
    });
    if (printer) break;
  }

  if (!printer) return NextResponse.json({ printer: null, cartridges: [] });

  return NextResponse.json({
    printer: {
      brand: printer.brand,
      family: printer.family,
      kind: printer.kind,
      chipNote: printer.chipNote,
    },
    cartridges: printer.cartridges.map((pc: any) => ({
      brand: pc.cartridge.brand,
      model: pc.cartridge.model,
      hasChip: pc.cartridge.hasChip,
    })),
  });
}
