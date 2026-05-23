import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { suggestYandexAddresses } from "@/lib/geocoder";

export async function GET(req: NextRequest) {
  await requireUser();
  const q = req.nextUrl.searchParams.get("q")?.trim() || "";
  if (q.length < 3) return NextResponse.json({ suggestions: [] });

  const addresses = await prisma.address.findMany({
    where: {
      OR: [
        { address: { contains: q } },
        { formattedAddress: { contains: q } },
        { district: { contains: q } },
      ],
    },
    include: { client: { select: { name: true, phone: true } } },
    orderBy: { geocodedAt: "desc" },
    take: 12,
  });

  const yandexSuggestions = await suggestYandexAddresses(q, 8);
  const seen = new Set<string>();

  const suggestions = [
    ...addresses.map((address) => ({
      value: address.address,
      title: address.formattedAddress || address.address,
      subtitle: [
        address.district,
        address.client?.name,
        address.client?.phone,
      ].filter(Boolean).join(" · "),
      kind: "CRM",
    })),
    ...yandexSuggestions.map((address) => ({
      value: address.value,
      title: address.title,
      subtitle: address.subtitle,
      kind: "Карта",
    })),
  ]
    .filter((item) => {
      const key = item.value.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 8);

  return NextResponse.json({ suggestions });
}
