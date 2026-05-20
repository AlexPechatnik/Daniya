import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  await requireUser();
  const q = req.nextUrl.searchParams.get("q")?.trim() || "";
  if (!q) return NextResponse.json({ clients: [] });
  const digits = q.replace(/\D/g, "");
  const clients = await prisma.client.findMany({
    where: {
      OR: [
        digits ? { phone: { contains: digits } } : undefined,
        { name: { contains: q } },
        { org: { contains: q } },
      ].filter(Boolean) as any,
    },
    include: {
      addresses: true,
      requests: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { service: true, address: true },
      },
    },
    take: 10,
  });
  // Подготавливаем «компактный» last request для UI
  const payload = clients.map((c) => ({
    id: c.id,
    name: c.name,
    org: c.org,
    phone: c.phone,
    addresses: c.addresses,
    lastRequest: c.requests[0]
      ? {
          id: c.requests[0].id,
          serviceId: c.requests[0].serviceId,
          serviceName: c.requests[0].service?.name || null,
          addressId: c.requests[0].addressId,
          addressText: c.requests[0].address?.address || null,
          printerInfo: c.requests[0].printerInfo,
          when: c.requests[0].scheduledAt?.toISOString() || c.requests[0].createdAt.toISOString(),
        }
      : null,
  }));
  return NextResponse.json({ clients: payload });
}
