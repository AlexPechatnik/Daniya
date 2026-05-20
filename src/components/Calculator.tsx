"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Search, Sparkles, Check } from "lucide-react";
import { formatRub } from "@/lib/utils";
import Link from "next/link";
import { Reveal } from "./Reveal";

type Service = { id: string; name: string; kind: string; slug: string };
type Cartridge = {
  id: string;
  brand: string;
  model: string;
  type: string;
  isPopular: boolean;
  isOriginal: boolean;
  price: number | null;
};

export function Calculator({ services, cartridges }: { services: Service[]; cartridges: Cartridge[] }) {
  const [serviceId, setServiceId] = useState(services[0]?.id || "");
  const [query, setQuery] = useState("");
  const [brand, setBrand] = useState<string>("all");
  const [sort, setSort] = useState<"popular" | "brand" | "price">("popular");
  const [cartridgeId, setCartridgeId] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [pending, startTransition] = useTransition();
  const [estimate, setEstimate] = useState<number | null>(null);

  const brands = useMemo(() => Array.from(new Set(cartridges.map((c) => c.brand))).sort(), [cartridges]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = cartridges.filter((c) => {
      if (brand !== "all" && c.brand !== brand) return false;
      if (!q) return true;
      return c.model.toLowerCase().includes(q) || c.brand.toLowerCase().includes(q);
    });
    list.sort((a, b) => {
      if (sort === "popular") return Number(b.isPopular) - Number(a.isPopular) || a.model.localeCompare(b.model);
      if (sort === "brand") return a.brand.localeCompare(b.brand) || a.model.localeCompare(b.model);
      return (a.price ?? Infinity) - (b.price ?? Infinity);
    });
    return list.slice(0, 30);
  }, [cartridges, query, brand, sort]);

  useEffect(() => {
    if (!serviceId) return;
    startTransition(async () => {
      const res = await fetch("/api/estimate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ serviceId, cartridgeId, quantity: qty }),
      });
      const data = await res.json();
      setEstimate(data.amount);
    });
  }, [serviceId, cartridgeId, qty]);

  const selected = cartridges.find((c) => c.id === cartridgeId);

  return (
    <section id="calculator" className="container py-20 lg:py-28">
      <Reveal>
        <div className="flex items-end justify-between gap-6 flex-wrap mb-10">
          <div>
            <div className="chip mb-4"><span className="font-mono text-primary">04</span> Калькулятор</div>
            <h2 className="heading-display text-4xl md:text-5xl lg:text-6xl">
              Узнайте цену <span className="text-gradient">за минуту</span>
            </h2>
          </div>
          <p className="text-muted-fg max-w-md">Ориентир — точная сумма у мастера на месте. Зависит от модели и состояния картриджа.</p>
        </div>
      </Reveal>

      <Reveal>
        <div className="card overflow-hidden relative">
          <div className="grid lg:grid-cols-[1fr,400px]">
            <div className="p-6 lg:p-8 space-y-7">
              <Step n={1} title="Услуга">
                <div className="grid grid-cols-2 gap-2">
                  {services.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setServiceId(s.id)}
                      className={`group relative rounded-xl border px-4 py-3 text-sm text-left transition-all ${
                        serviceId === s.id
                          ? "border-primary bg-primary/10 text-fg"
                          : "border-border bg-card/40 hover:bg-card hover:border-border"
                      }`}
                    >
                      {serviceId === s.id && <Check className="absolute right-3 top-3 h-3.5 w-3.5 text-primary" />}
                      {s.name}
                    </button>
                  ))}
                </div>
              </Step>

              <Step n={2} title="Картридж">
                <div className="flex flex-wrap gap-2 mb-3">
                  <div className="relative flex-1 min-w-[220px]">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-fg" />
                    <input
                      className="input pl-10"
                      placeholder="Модель картриджа или принтера"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </div>
                  <select className="input w-auto" value={brand} onChange={(e) => setBrand(e.target.value)}>
                    <option value="all">Все бренды</option>
                    {brands.map((b) => <option key={b} value={b}>{b}</option>)}
                  </select>
                  <select className="input w-auto" value={sort} onChange={(e) => setSort(e.target.value as any)}>
                    <option value="popular">Популярные</option>
                    <option value="brand">По бренду</option>
                    <option value="price">По цене</option>
                  </select>
                </div>

                <div className="max-h-72 overflow-auto rounded-xl border border-border divide-y divide-border bg-bg/40">
                  {filtered.length === 0 && (
                    <div className="p-6 text-center text-sm text-muted-fg">Не нашли — впишите модель в комментарий к заявке.</div>
                  )}
                  {filtered.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setCartridgeId(c.id === cartridgeId ? null : c.id)}
                      className={`w-full flex items-center justify-between gap-3 px-4 py-3 text-left text-sm transition ${
                        cartridgeId === c.id ? "bg-primary/10" : "hover:bg-muted/40"
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="font-medium flex items-center gap-2 truncate">
                          <span className="text-muted-fg font-mono text-xs">{c.brand}</span>
                          {c.model}
                        </div>
                        <div className="text-xs text-muted-fg mt-1 flex items-center gap-2">
                          {c.isPopular && <Badge tone="primary">Популярный</Badge>}
                          {c.isOriginal ? <Badge tone="warning">Оригинал</Badge> : <Badge tone="muted">Совместимый</Badge>}
                        </div>
                      </div>
                      {c.price != null && <div className="text-sm tabular-nums text-fg shrink-0">{formatRub(c.price)}</div>}
                    </button>
                  ))}
                </div>
              </Step>

              <Step n={3} title="Количество">
                <div className="inline-flex items-center rounded-xl border border-border bg-card/40">
                  <button type="button" className="px-4 py-2.5 hover:bg-muted transition rounded-l-xl" onClick={() => setQty((q) => Math.max(1, q - 1))}>−</button>
                  <span className="w-12 text-center text-sm tabular-nums font-medium">{qty}</span>
                  <button type="button" className="px-4 py-2.5 hover:bg-muted transition rounded-r-xl" onClick={() => setQty((q) => q + 1)}>+</button>
                </div>
              </Step>
            </div>

            <aside className="relative bg-gradient-to-br from-card-2 to-card border-l border-border p-6 lg:p-8">
              <div className="absolute -top-px -left-px -right-px h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
              <div className="chip"><Sparkles className="h-3 w-3 text-primary" /> Ваш расчёт</div>
              <div className="mt-6 space-y-4 text-sm">
                <Row label="Услуга" value={services.find((s) => s.id === serviceId)?.name || "—"} />
                <Row label="Картридж" value={selected ? `${selected.brand} ${selected.model}` : "не выбран"} />
                <Row label="Количество" value={`${qty} шт.`} />
              </div>
              <div className="mt-6 pt-6 border-t border-border">
                <div className="text-xs uppercase tracking-wider text-muted-fg">Итого ориентировочно</div>
                <div className="mt-2 text-4xl font-semibold tabular-nums tracking-tight">
                  {pending ? <span className="text-muted-fg">…</span> : formatRub(estimate ?? 0)}
                </div>
              </div>
              <Link href="#request" className="btn-primary btn-glow w-full mt-6 py-3">Оставить заявку</Link>
              <div className="mt-5 rounded-lg border border-border bg-bg/40 p-3 text-xs text-muted-fg leading-relaxed">
                <span className="text-fg font-medium">Если время важнее процесса</span> — можем привезти уже заправленный картридж, а ваш забрать в сервис. По той же цене, офис продолжает печатать через 5 минут.
              </div>
              <p className="mt-3 text-xs text-muted-fg leading-relaxed">
                Оплата — после проверки печати. Не заработало — не платите.
              </p>
            </aside>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <div className="h-7 w-7 rounded-lg bg-primary/15 border border-primary/30 text-primary text-xs font-mono flex items-center justify-center">{n}</div>
        <div className="text-sm font-medium text-fg/80">{title}</div>
      </div>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <div className="text-muted-fg">{label}</div>
      <div className="font-medium text-right truncate">{value}</div>
    </div>
  );
}

function Badge({ children, tone = "primary" }: { children: React.ReactNode; tone?: "primary" | "warning" | "muted" }) {
  const cls = {
    primary: "bg-primary/15 text-primary border-primary/20",
    warning: "bg-warning/15 text-warning border-warning/20",
    muted: "bg-muted text-muted-fg border-border",
  }[tone];
  return <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium ${cls}`}>{children}</span>;
}
