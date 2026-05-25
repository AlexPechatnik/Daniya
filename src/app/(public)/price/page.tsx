import { prisma } from "@/lib/db";
import type { Metadata } from "next";
import Link from "next/link";
import { PriceCatalog, type PriceRow } from "@/components/PriceCatalog";

export const metadata: Metadata = {
  title: "Цены на заправку и ремонт картриджей в СПб — 2026",
  description: "Прозрачный прайс по картриджам и принтерам: заправка, замена, диагностика, ремонт. Поиск, сортировка, фильтры.",
};

export const dynamic = "force-dynamic";

const SERVICE_FACTS: Record<string, { from: number; about: string }> = {
  zapravka:   { from: 500,  about: "Заправляем оригинальным тонером Static Control/Mitsubishi. Чек, гарантия 30 дней." },
  zamena:     { from: 700,  about: "Замена картриджа на оригинал/совместимый. Привозим картридж в наличии." },
  diagnostika:{ from: 700,  about: "Полная диагностика на месте за 20–30 минут. При заказе ремонта — бесплатно." },
  remont:     { from: 1500, about: "Чистка, замена термопары, муфт, ролика подхвата. Сложный ремонт — в мастерской." },
};

export default async function Page() {
  const [services, prices] = await Promise.all([
    prisma.service.findMany({ orderBy: { name: "asc" } }),
    prisma.price.findMany({
      include: { service: true, cartridge: true },
      orderBy: [{ cartridge: { brand: "asc" } }, { cartridge: { model: "asc" } }],
    }),
  ]);

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

  return (
    <section className="container py-16 lg:py-24">
      <Link href="/" className="chip mb-6 hover:text-fg transition">← На главную</Link>

      <div className="max-w-3xl">
        <h1 className="heading-display text-4xl md:text-5xl lg:text-6xl">Прайс на 2026</h1>
        <p className="mt-5 text-muted-fg leading-relaxed">
          Все цены ориентировочные, опираются на среднюю цену по Санкт-Петербургу.
          Точная стоимость — на месте: зависит от модели, состояния картриджа и объёма работ.
        </p>
      </div>

      {/* Карточки услуг — что во сколько обходится и почему */}
      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {services.map((s) => {
          const fact = SERVICE_FACTS[s.slug];
          return (
            <div key={s.id} className="card rounded-3xl p-5 transition hover:shadow-md">
              <div className="text-xs uppercase tracking-wider text-muted-fg">{s.kind}</div>
              <div className="mt-1 text-lg font-semibold">{s.name}</div>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-xs text-muted-fg">от</span>
                <span className="text-2xl font-semibold tabular-nums">{(fact?.from ?? 500).toLocaleString("ru-RU")}</span>
                <span className="text-sm text-muted-fg">₽</span>
              </div>
              {fact?.about && <p className="mt-3 text-sm text-muted-fg leading-relaxed">{fact.about}</p>}
            </div>
          );
        })}
      </div>

      {/* Каталог: поиск + фильтры + сортировка */}
      <div className="mt-14">
        <h2 className="text-2xl font-semibold tracking-tight">Картриджи в работе</h2>
        <p className="mt-2 text-sm text-muted-fg">
          {rows.length} позиций · нажмите на строку, чтобы увидеть совместимые принтеры и факты о картридже.
        </p>
        <div className="mt-6">
          <PriceCatalog rows={rows} />
        </div>
      </div>

      {/* CTA */}
      <div className="mt-16 rounded-3xl border border-border bg-card p-8 text-center lg:p-12">
        <h3 className="text-2xl font-semibold tracking-tight">Не нашли вашу модель?</h3>
        <p className="mx-auto mt-3 max-w-xl text-muted-fg">
          У нас на складе — более 250 совместимых картриджей. Напишите модель — назовём цену в течение 15 минут.
        </p>
        <Link href="/#request" className="btn-primary mt-6 inline-flex">Оставить заявку</Link>
      </div>
    </section>
  );
}
