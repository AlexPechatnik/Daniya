/**
 * Конвертация старых RequestLead → Request.
 * Раньше /api/submitLead для нового клиента создавал RequestLead,
 * который нигде в CRM не показывался. Теперь логика создаёт Request сразу.
 * Этот скрипт пробегает по необработанным RequestLead и материализует их
 * в полноценные Request + Client + Address.
 *
 * Запуск: npm run convert:leads
 */
import { PrismaClient } from "@prisma/client";
import { enrichAddress } from "../src/lib/districts";

const prisma = new PrismaClient();

async function main() {
  const leads = await prisma.requestLead.findMany({
    where: { processed: false },
    orderBy: { createdAt: "asc" },
  });
  console.log(`→ ${leads.length} необработанных лидов`);

  const slugMap: Record<string, string> = {
    REFILL: "zapravka",
    REPLACE: "zamena",
    DIAGNOSTIC: "diagnostika",
    REPAIR: "remont",
  };

  for (const lead of leads) {
    let client = await prisma.client.findUnique({ where: { phone: lead.phone } });
    if (!client) {
      client = await prisma.client.create({
        data: { name: lead.name, phone: lead.phone },
      });
    }

    let addressId: string | null = null;
    if (lead.address) {
      const addr = await prisma.address.create({
        data: { clientId: client.id, ...(await enrichAddress(lead.address)) },
      });
      addressId = addr.id;
    }

    let serviceId: string | null = null;
    if (lead.serviceKind) {
      const slug = slugMap[lead.serviceKind];
      if (slug) {
        const svc = await prisma.service.findUnique({ where: { slug } });
        serviceId = svc?.id || null;
      }
    }

    const last = await prisma.request.findFirst({ orderBy: { number: "desc" }, select: { number: true } });
    const created = await prisma.request.create({
      data: {
        number: (last?.number ?? 0) + 1,
        clientId: client.id,
        addressId,
        serviceId,
        source: "WEB",
        status: "NEW",
        printerInfo: lead.cartridge,
        comment: lead.comment,
        createdAt: lead.createdAt,
      },
    });

    await prisma.requestLead.update({
      where: { id: lead.id },
      data: { processed: true },
    });

    console.log(`  ✓ Lead → Request #${created.number} (${lead.name}, ${lead.phone})`);
  }

  console.log("Готово.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
