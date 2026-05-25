import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { detectPrintType, INKJET_SERVICE_SLUGS, INKJET_PRICING_NOTE } from "@/lib/printerType";

/**
 * GET /api/public/cartridges-for-printer?q=HP+LaserJet+M404dn
 *
 * Лазерный принтер → подходящие картриджи и их цены.
 * Струйный принтер  → НЕ возвращаем «чернила» как картриджи (это не наша
 *   модель прайса), вместо этого отдаём список услуг струйного сервиса
 *   и пометку, что цена уточняется после диагностики.
 *
 * Ответ:
 *   { printer, printType: "laser" | "inkjet" | null,
 *     cartridges: [...],        // только для лазерных
 *     services: [...],          // только для струйных
 *     pricingNote?: string }
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() || "";
  if (q.length < 2) {
    return NextResponse.json({ printer: null, printType: null, cartridges: [], services: [] });
  }

  const query = normalize(q);
  const tokens = query.split(/\s+/).filter((t) => t.length >= 2);
  const numberTokens = tokens.filter((t) => /\d/.test(t));
  const brandTokens = new Set(["hp", "canon", "brother", "epson", "xerox", "samsung", "kyocera", "ricoh", "pantum", "oki"]);

  const candidates = await prisma.printerModel.findMany({
    where: {
      OR: tokens.flatMap((t) => [
        { brand: { contains: t } },
        { family: { contains: t } },
        { aliases: { contains: t } },
      ]),
    },
    include: { cartridges: { include: { cartridge: true } } },
  });

  const printer = candidates
    .map((candidate: any) => {
      const hay = normalize(`${candidate.brand} ${candidate.family} ${candidate.aliases}`);
      let score = 0;
      for (const token of tokens) {
        if (hay.includes(token)) score += /\d/.test(token) ? 12 : 3;
      }
      for (const token of numberTokens) {
        if (hay.includes(token)) score += 10;
      }
      for (const token of tokens) {
        if (brandTokens.has(token) && normalize(candidate.brand) === token) score += 20;
      }
      if (hay.includes(query)) score += 20;
      if (candidate.demand === "A") score += 2;
      if (candidate.demand === "B") score += 1;
      return { candidate, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)[0]?.candidate;

  if (!printer) {
    return NextResponse.json({ printer: null, printType: null, cartridges: [], services: [] });
  }

  const printType = detectPrintType(printer.kind);
  const printerPayload = {
    brand: printer.brand,
    family: printer.family,
    kind: printer.kind,
    chipNote: printer.chipNote,
  };

  // Для струйных — другая модель работы: набор услуг + «уточняется».
  if (printType === "inkjet") {
    const inkjetServices = await prisma.service.findMany({
      where: { slug: { in: [...INKJET_SERVICE_SLUGS] } },
      include: { prices: { where: { cartridgeId: null }, take: 1 } },
    });
    const ordered = INKJET_SERVICE_SLUGS
      .map((slug) => inkjetServices.find((s) => s.slug === slug))
      .filter((s): s is NonNullable<typeof s> => !!s)
      .map((s) => ({
        slug: s.slug,
        name: s.name,
        fromAmount: s.prices[0]?.amount ?? null, // ₽ в копейках, «от ...»
      }));
    return NextResponse.json({
      printer: printerPayload,
      printType,
      cartridges: [],
      services: ordered,
      pricingNote: INKJET_PRICING_NOTE,
    });
  }

  // Лазер: классический ответ с картриджами (струйных среди связей не пускаем).
  return NextResponse.json({
    printer: printerPayload,
    printType,
    cartridges: printer.cartridges
      .filter((pc: any) => pc.cartridge.type !== "струйный")
      .map((pc: any) => ({
        brand: pc.cartridge.brand,
        model: pc.cartridge.model,
        hasChip: pc.cartridge.hasChip,
      })),
    services: [],
  });
}

function normalize(value: string) {
  return value.toLowerCase().replace(/ё/g, "е").replace(/[^a-zа-я0-9]+/g, " ").trim();
}
