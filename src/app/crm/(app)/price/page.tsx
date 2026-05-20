import { requireAdmin } from "@/lib/auth";
import { PriceImporter } from "@/components/crm/PriceImporter";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function PriceAdminPage() {
  await requireAdmin();
  const services = await prisma.service.findMany();
  const total = await prisma.price.count();
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">Прайс</h1>
      <div className="card p-5 max-w-2xl">
        <div className="font-semibold">Импорт из Excel</div>
        <p className="mt-2 text-sm text-muted-fg">
          Колонки: <code>Услуга</code> (slug), <code>Бренд</code>, <code>Модель</code>, <code>Цена</code> (₽), <code>Заметка</code> (опционально).
        </p>
        <p className="mt-1 text-sm text-muted-fg">Доступные slug услуг: {services.map((s) => s.slug).join(", ")}</p>
        <div className="mt-4"><PriceImporter /></div>
        <div className="mt-4 text-xs text-muted-fg">Сейчас в прайсе: {total} позиций</div>
      </div>
    </div>
  );
}
