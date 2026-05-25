"use client";

import { useMemo, useState } from "react";
import { Search, ArrowUpDown, ArrowUp, ArrowDown, Zap, Layers, Star } from "lucide-react";

/**
 * Публичный каталог прайса.
 *   • Сегментированный фильтр услуг (Apple-segmented control)
 *   • Чипы брендов (множественный выбор)
 *   • Поиск по бренду/модели/совместимости
 *   • Сортировка по бренду / модели / цене / ресурсу
 *   • Лёгкая раскрываемая строка с фактами картриджа
 */
export type PriceRow = {
  id: string;
  serviceSlug: string;
  serviceName: string;
  serviceKind: string;
  amount: number; // ₽
  note?: string | null;
  cartridge?: {
    brand: string;
    model: string;
    type: string;
    hasChip: boolean;
    pageYield?: number | null;
    compatible?: string | null;
    isPopular: boolean;
  } | null;
};

type Sort =
  | { key: "brand"; dir: "asc" | "desc" }
  | { key: "model"; dir: "asc" | "desc" }
  | { key: "amount"; dir: "asc" | "desc" }
  | { key: "yield"; dir: "asc" | "desc" };

const SERVICE_TABS = [
  { slug: "all", label: "Все услуги" },
  { slug: "zapravka", label: "Заправка" },
  { slug: "zamena", label: "Замена" },
  { slug: "diagnostika", label: "Диагностика" },
  { slug: "remont", label: "Ремонт" },
];

function formatRub(amount: number) {
  return `${amount.toLocaleString("ru-RU")} ₽`;
}

function formatYield(y?: number | null) {
  if (!y) return "—";
  if (y >= 1000) return `${(y / 1000).toFixed(y % 1000 === 0 ? 0 : 1)} тыс. стр.`;
  return `${y} стр.`;
}

export function PriceCatalog({ rows }: { rows: PriceRow[] }) {
  const [query, setQuery] = useState("");
  const [service, setService] = useState<string>("all");
  const [brandsOn, setBrandsOn] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<Sort>({ key: "brand", dir: "asc" });
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const brands = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => r.cartridge && set.add(r.cartridge.brand));
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter((r) => service === "all" || r.serviceSlug === service)
      .filter((r) => {
        if (brandsOn.size === 0) return true;
        if (!r.cartridge) return false;
        return brandsOn.has(r.cartridge.brand);
      })
      .filter((r) => {
        if (!q) return true;
        const hay = [
          r.cartridge?.brand,
          r.cartridge?.model,
          r.cartridge?.compatible,
          r.note,
          r.serviceName,
        ].filter(Boolean).join(" ").toLowerCase();
        return hay.includes(q);
      });
  }, [rows, query, service, brandsOn]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const dir = sort.dir === "asc" ? 1 : -1;
      const av =
        sort.key === "amount" ? a.amount :
        sort.key === "yield" ? (a.cartridge?.pageYield || 0) :
        sort.key === "model" ? (a.cartridge?.model || a.note || "") :
        (a.cartridge?.brand || "");
      const bv =
        sort.key === "amount" ? b.amount :
        sort.key === "yield" ? (b.cartridge?.pageYield || 0) :
        sort.key === "model" ? (b.cartridge?.model || b.note || "") :
        (b.cartridge?.brand || "");
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv), "ru") * dir;
    });
    return arr;
  }, [filtered, sort]);

  function toggleBrand(b: string) {
    setBrandsOn((prev) => {
      const next = new Set(prev);
      if (next.has(b)) next.delete(b);
      else next.add(b);
      return next;
    });
  }

  function sortBy(key: Sort["key"]) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  }

  return (
    <div className="space-y-6">
      {/* Поиск + сегменты */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-fg" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Найти картридж, принтер, услугу…"
            className="input h-12 w-full rounded-2xl border-border bg-card pl-11 pr-4 text-base"
          />
        </div>

        <div className="inline-flex rounded-full bg-bg-2 p-1 text-sm">
          {SERVICE_TABS.map((t) => (
            <button
              key={t.slug}
              type="button"
              onClick={() => setService(t.slug)}
              className={`rounded-full px-4 py-2 transition-colors ${
                service === t.slug ? "bg-card text-fg shadow-sm" : "text-muted-fg hover:text-fg"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Чипы брендов */}
      {brands.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-wider text-muted-fg">Бренд:</span>
          {brands.map((b) => {
            const on = brandsOn.has(b);
            return (
              <button
                key={b}
                type="button"
                onClick={() => toggleBrand(b)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  on
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-muted-fg hover:text-fg hover:border-primary/40"
                }`}
              >
                {b}
              </button>
            );
          })}
          {brandsOn.size > 0 && (
            <button
              type="button"
              onClick={() => setBrandsOn(new Set())}
              className="text-xs text-muted-fg hover:text-fg underline underline-offset-2"
            >
              сбросить
            </button>
          )}
        </div>
      )}

      {/* Таблица */}
      <div className="overflow-hidden rounded-3xl border border-border bg-card">
        <div className="grid grid-cols-[1fr,80px,120px,120px] gap-3 border-b border-border bg-bg-2/70 px-5 py-3 text-xs font-medium uppercase tracking-wider text-muted-fg">
          <SortHead label="Картридж / Описание" k="brand" sort={sort} onClick={() => sortBy("brand")} />
          <span className="text-center">Чип</span>
          <SortHead label="Ресурс" k="yield" sort={sort} onClick={() => sortBy("yield")} align="right" />
          <SortHead label="Цена" k="amount" sort={sort} onClick={() => sortBy("amount")} align="right" />
        </div>

        <ul className="divide-y divide-border">
          {sorted.length === 0 && (
            <li className="px-5 py-12 text-center text-sm text-muted-fg">
              Ничего не нашли. Уточните запрос или позвоните — подскажем по телефону.
            </li>
          )}

          {sorted.map((row) => {
            const c = row.cartridge;
            const expanded = expandedId === row.id;
            return (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : row.id)}
                  className="grid w-full grid-cols-[1fr,80px,120px,120px] items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-bg-2/60"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="font-medium tracking-tight">
                        {c ? `${c.brand} ${c.model}` : row.note || row.serviceName}
                      </span>
                      <span className="text-xs text-muted-fg">{row.serviceName.toLowerCase()}</span>
                      {c?.isPopular && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-600">
                          <Star className="h-3 w-3" /> Хит
                        </span>
                      )}
                    </div>
                    {c?.compatible && (
                      <div className="mt-0.5 truncate text-xs text-muted-fg">{c.compatible}</div>
                    )}
                  </div>

                  <div className="text-center text-xs">
                    {c?.hasChip ? (
                      <span className="inline-flex items-center gap-1 text-amber-600">
                        <Zap className="h-3 w-3" /> чип
                      </span>
                    ) : (
                      <span className="text-muted-fg/60">—</span>
                    )}
                  </div>

                  <div className="text-right text-sm tabular-nums text-muted-fg">
                    {formatYield(c?.pageYield)}
                  </div>

                  <div className="text-right text-base font-semibold tabular-nums">
                    {formatRub(row.amount)}
                  </div>
                </button>

                {expanded && (
                  <div className="border-t border-border/60 bg-bg-2/40 px-5 py-4 text-sm text-muted-fg">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <Fact icon={Layers} label="Тип" value={c?.type ? capitalize(c.type) : "—"} />
                      <Fact icon={Zap} label="Чип" value={c?.hasChip ? "есть · +150 ₽ за замену" : "без чипа"} />
                      <Fact icon={Star} label="Ресурс" value={formatYield(c?.pageYield)} />
                    </div>
                    {c?.compatible && (
                      <div className="mt-3">
                        <div className="text-xs uppercase tracking-wider">Подходит к принтерам</div>
                        <div className="mt-1 text-fg">{c.compatible}</div>
                      </div>
                    )}
                    {row.note && (
                      <div className="mt-3 text-xs text-muted-fg">{row.note}</div>
                    )}
                    <a
                      href="/#request"
                      className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-fg shadow-sm transition hover:opacity-90"
                    >
                      Заказать «{row.serviceName.toLowerCase()}» →
                    </a>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="text-center text-xs text-muted-fg">
        Показано {sorted.length} из {rows.length}. Цены ориентировочные, точная — на месте.
      </div>
    </div>
  );
}

function SortHead({
  label, k, sort, onClick, align = "left",
}: { label: string; k: Sort["key"]; sort: Sort; onClick: () => void; align?: "left" | "right" }) {
  const active = sort.key === k;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1 text-xs uppercase tracking-wider transition-colors hover:text-fg ${
        align === "right" ? "justify-end" : "justify-start"
      } ${active ? "text-fg" : ""}`}
    >
      {label}
      {active ? (
        sort.dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-40" />
      )}
    </button>
  );
}

function Fact({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 h-4 w-4 text-muted-fg/70" />
      <div>
        <div className="text-xs uppercase tracking-wider">{label}</div>
        <div className="mt-0.5 text-fg">{value}</div>
      </div>
    </div>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
