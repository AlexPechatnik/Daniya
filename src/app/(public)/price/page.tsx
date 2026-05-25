import { prisma } from "@/lib/db";
import type { Metadata } from "next";
import Link from "next/link";
import { PriceCatalog, type PriceRow } from "@/components/PriceCatalog";
import { PrinterCartridgeFinder } from "@/components/PrinterCartridgeFinder";
import { cartridges as fmtCartridges, servicesCount as fmtServices } from "@/lib/plural";

export const metadata: Metadata = {
  title: "Прайс на сервис принтеров в СПб — 2026",
  description:
    "Прозрачный прайс по заправке, замене, диагностике и ремонту принтеров. Поиск картриджа по модели принтера.",
};

export const dynamic = "force-dynamic";

export default async function Page() {
  const prices = await prisma.price.findMany({
    include: { service: true, cartridge: true },
    orderBy: [{ cartridge: { brand: "asc" } }, { cartridge: { model: "asc" } }],
  });

  const rows: PriceRow[] = prices.map((p) => ({
    id: p.id,
    serviceSlug: p.service.slug,
    serviceName: p.service.name,
    serviceKind: p.service.kind,
    amount: Math.round(p.amount / 100),
    note: p.note,
    cartridge: p.cartridge
      ? {
          brand: p.cartridge.brand,
          model: p.cartridge.model,
          type: p.cartridge.type,
          hasChip: p.cartridge.hasChip,
          pageYield: p.cartridge.pageYield,
          compatible: p.cartridge.compatible,
          isPopular: p.cartridge.isPopular,
        }
      : null,
  }));

  const cartridgeCount = rows.filter((r) => r.cartridge).length;
  const serviceOnlyCount = rows.length - cartridgeCount;

  return (
    <section className="container py-16 lg:py-24">
      <Link href="/" className="chip mb-6 hover:text-fg transition">← На главную</Link>

      {/* HERO — одна сильная фраза и подзаголовок. HIG: clarity, focus. */}
      <div className="max-w-3xl">
        <h1 className="heading-display text-4xl md:text-5xl lg:text-6xl">Прайс на 2026</h1>
        <p className="mt-5 text-lg text-muted-fg leading-relaxed">
          {fmtCartridges(cartridgeCount)} с фиксированной ценой заправки и {fmtServices(serviceOnlyCount)} ремонта.
          Цены ориентировочные — точная стоимость на месте после осмотра.
        </p>
      </div>

      {/* Поиск картриджа по принтеру — главный инструмент страницы. */}
      <div className="mt-10">
        <PrinterCartridgeFinder />
      </div>

      {/* Один каталог: категории + поиск + таблица — единая точка взаимодействия. */}
      <div id="catalog" className="mt-14">
        <PriceCatalog rows={rows} />
      </div>
    </section>
  );
}
