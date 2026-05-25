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

function normalize(value: string) {
  return value.toLowerCase().replace(/ё/g, "е").replace(/[^a-zа-я0-9]+/g, " ").trim();
}
