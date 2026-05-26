import { requireAdmin } from "@/lib/auth";
import { PriceImporter } from "@/components/crm/PriceImporter";
import { PriceTable, type CrmPriceRow } from "@/components/crm/PriceTable";
import { prisma } from "@/lib/db";
import { Download } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PriceAdminPage() {
  await requireAdmin();

  const [services, prices] = await Promise.all([
    prisma.service.findMany({ orderBy: { name: "asc" } }),
    prisma.price.findMany({
      include: { service: true, cartridge: true },
      orderBy: [
        { service: { name: "asc" } },
        { cartridge: { brand: "asc" } },
        { cartridge: { model: "asc" } },
      ],
    }),
  ]);

  const rows: CrmPriceRow[] = prices.map((p) => ({
    id: p.id,
    serviceId: p.serviceId,
    serviceSlug: p.service.slug,
    serviceName: p.service.name,
    amount: Math.round(p.amount / 100),
    note: p.note,
    cartridge: p.cartridge
      ? {
          brand: p.cartridge.brand,
          model: p.cartridge.model,
          type: p.cartridge.type,
          hasChip: p.cartridge.hasChip,
          pageYield: p.cartridge.pageYield,
        }
      : null,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Прайс</h1>
          <p className="mt-1 text-sm text-muted-fg">
            Всего {rows.length} позиций. Редактируйте прямо в таблице или массово через Excel.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href="/api/price/export"
            className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-medium hover:border-primary hover:text-primary"
            download
          >
            <Download className="h-4 w-4" /> Скачать xlsx
          </a>
        </div>
      </div>

      {/* Импорт — в свёрнутом блоке, чтобы не отвлекать от таблицы */}
      <details className="card rounded-2xl p-5">
        <summary className="cursor-pointer text-sm font-semibold">Импорт прайс-системы из Excel</summary>
        <div className="mt-4 space-y-3 text-sm text-muted-fg">
          <p>
            Сначала нажмите <b>«Скачать xlsx»</b> — это полный экспорт системы.
            В файле 5 листов, любой из них можно редактировать и грузить обратно:
          </p>
          <ul className="ml-4 list-disc space-y-1 text-xs">
            <li><b>Услуги</b> — каталог услуг: категория, тип принтера, базовая цена, заметка</li>
            <li><b>Картриджи</b> — расходники: тип, чип, ресурс, совместимость</li>
            <li><b>Принтеры</b> — модели: <code>laser</code> или <code>inkjet</code></li>
            <li><b>Совместимость</b> — связи принтер ↔ картридж</li>
            <li><b>Цены</b> — итоговый прайс: услуга × картридж</li>
          </ul>
          <p className="text-xs">
            Можно загружать частично — отсутствующие листы просто пропускаются. Изменения идемпотентны: ничего не дублируется.
          </p>
        </div>
        <div className="mt-4">
          <PriceImporter />
        </div>
      </details>

      <PriceTable initialRows={rows} services={services.map((s) => ({ id: s.id, slug: s.slug, name: s.name }))} />
    </div>
  );
}
