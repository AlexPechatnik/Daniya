import { prisma } from "@/lib/db";
import { formatRub } from "@/lib/utils";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Цены на заправку и ремонт картриджей в СПб",
  description: "Прозрачный прайс: заправка, замена, диагностика, ремонт принтеров.",
};

export const dynamic = "force-dynamic";

export default async function Page() {
  const services = await prisma.service.findMany({
    include: {
      prices: { include: { cartridge: true }, orderBy: [{ cartridge: { brand: "asc" } }, { cartridge: { model: "asc" } }] },
    },
    orderBy: { name: "asc" },
  });

  return (
    <section className="container py-16 lg:py-24">
      <Link href="/" className="chip mb-6 hover:text-fg transition">← На главную</Link>
      <h1 className="heading-display text-4xl md:text-5xl lg:text-6xl">Прайс</h1>
      <p className="mt-5 text-muted-fg max-w-2xl leading-relaxed">
        Цены ориентировочные. Точная стоимость зависит от модели картриджа, состояния и объёма работ — уточняется мастером на месте.
      </p>

      <div className="mt-12 space-y-6">
        {services.map((s) => (
          <div key={s.id} className="card overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-card-2/40">
              <div className="font-semibold flex items-center gap-3">
                <span className="font-mono text-xs text-primary uppercase">{s.kind}</span>
                {s.name}
              </div>
              <Link href="/#request" className="text-sm text-primary hover:underline">Заказать →</Link>
            </div>
            <div className="divide-y divide-border">
              {s.prices.length === 0 && <div className="px-6 py-8 text-sm text-muted-fg">Прайс уточняется — позвоните нам.</div>}
              {s.prices.map((p) => (
                <div key={p.id} className="px-6 py-3 flex items-center justify-between gap-3 hover:bg-muted/20 transition">
                  <div className="text-sm">
                    {p.cartridge ? (
                      <><span className="font-mono text-xs text-muted-fg mr-2">{p.cartridge.brand}</span>{p.cartridge.model}</>
                    ) : (
                      <span className="text-muted-fg">{p.note || "Базовая цена"}</span>
                    )}
                  </div>
                  <div className="text-sm font-medium tabular-nums">{formatRub(p.amount)}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
