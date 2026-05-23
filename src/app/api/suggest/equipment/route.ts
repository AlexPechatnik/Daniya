import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  await requireUser();
  const q = req.nextUrl.searchParams.get("q")?.trim() || "";
  if (q.length < 2) return NextResponse.json({ suggestions: [] });

  const [cartridges, printers, requests] = await Promise.all([
    prisma.cartridge.findMany({
      where: {
        OR: [
          { brand: { contains: q } },
          { model: { contains: q } },
          { compatible: { contains: q } },
        ],
      },
      orderBy: [{ isPopular: "desc" }, { brand: "asc" }, { model: "asc" }],
      take: 8,
    }),
    prisma.printer.findMany({
      where: {
        OR: [
          { brand: { contains: q } },
          { model: { contains: q } },
        ],
      },
      include: { client: { select: { name: true } } },
      take: 6,
    }),
    prisma.request.findMany({
      where: { printerInfo: { contains: q } },
      select: { printerInfo: true },
      orderBy: { updatedAt: "desc" },
      take: 12,
    }),
  ]);

  const seen = new Set<string>();
  const suggestions = [
    ...cartridges.map((c) => ({
      value: `${c.brand} ${c.model}`.trim(),
      title: `${c.brand} ${c.model}`.trim(),
      subtitle: c.compatible || "картридж",
      kind: "Картридж",
    })),
    ...printers.map((p) => ({
      value: `${p.brand} ${p.model}`.trim(),
      title: `${p.brand} ${p.model}`.trim(),
      subtitle: p.client?.name ? `принтер · ${p.client.name}` : "принтер",
      kind: "Принтер",
    })),
    ...requests
      .map((r) => r.printerInfo?.trim())
      .filter((value): value is string => !!value)
      .map((value) => ({
        value,
        title: value,
        subtitle: "из прошлых заявок",
        kind: "История",
      })),
  ].filter((item) => {
    const key = item.value.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 10);

  return NextResponse.json({ suggestions });
}
