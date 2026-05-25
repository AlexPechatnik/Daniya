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

  // Ищем первое максимально точное совпадение.
  const printer = await prisma.printerModel.findFirst({
    where: {
      OR: [
        { family: { contains: q } },
        { aliases: { contains: q } },
      ],
    },
    include: { cartridges: { include: { cartridge: true } } },
    orderBy: [{ demand: "asc" }],
  });

  if (!printer) return NextResponse.json({ printer: null, cartridges: [] });

  return NextResponse.json({
    printer: {
      brand: printer.brand,
      family: printer.family,
      kind: printer.kind,
      chipNote: printer.chipNote,
    },
    cartridges: printer.cartridges.map((pc) => ({
      brand: pc.cartridge.brand,
      model: pc.cartridge.model,
      hasChip: pc.cartridge.hasChip,
    })),
  });
}
