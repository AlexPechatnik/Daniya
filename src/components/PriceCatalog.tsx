"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Layers,
  Search,
  Star,
  Wrench,
  Zap,
} from "lucide-react";
import { PRICE_CATEGORIES, priceCategoryForSlug } from "@/lib/priceStructure";
import { positions as fmtPositions } from "@/lib/plural";

export type PriceRow = {
  id: string;
  serviceSlug: string;
  serviceName: string;
  serviceKind: string;
  amount: number;
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

const PAGE_SIZE = 40;

const CATEGORY_HINTS: Record<string, string> = {
  visit_diagnostics: "Базовая оценка техники, выезд и первичная проверка.",
  laser_refill: "Цены считаются по модели картриджа, ресурсу и чипу.",
  cartridge_replacement: "Замена пустого картриджа на готовый или новый.",
  printer_repair: "Работы по узлам принтера. Запчасти считаются отдельно.",
  ciss_inkjet_service: "СНПЧ, печатающая головка, памперс и качество печати.",
  maintenance: "Профилактика, настройка и регулярное обслуживание.",
};

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
  const [category, setCategory] = useState<string>("laser_refill");
  const [service, setService] = useState<string>("all");
  const [brandsOn, setBrandsOn] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<Sort>({ key: "brand", dir: "asc" });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const categoryTabs = useMemo(() => {
    const used = new Set(rows.map((r) => priceCategoryForSlug(r.serviceSlug).id));
    return PRICE_CATEGORIES.filter((item) => used.has(item.id)).map((item) => {
      const isCartridgeCat = item.id === "laser_refill" || item.id === "cartridge_replacement";
      const sectionRows = rows.filter((row) => {
        if (priceCategoryForSlug(row.serviceSlug).id !== item.id) return false;
        // Те же фильтры, что и в основной выдаче: не считаем чернила как картриджи.
        if (isCartridgeCat && row.cartridge?.type === "струйный") return false;
        return true;
      });
      const min = sectionRows.length > 0 ? Math.min(...sectionRows.map((row) => row.amount)) : 0;
      return {
        ...item,
        count: sectionRows.length,
        from: min,
        hint: CATEGORY_HINTS[item.id] ?? item.description,
      };
    });
  }, [rows]);

  const activeCategory = categoryTabs.find((item) => item.id === category) ?? categoryTabs[0];
  const activeSlugs = useMemo(() => new Set<string>(activeCategory?.slugs ?? []), [activeCategory]);

  const services = useMemo(() => {
    const map = new Map<string, { slug: string; label: string; count: number }>();
    rows
      .filter((row) => activeSlugs.has(row.serviceSlug))
      .forEach((row) => {
        const existing = map.get(row.serviceSlug);
        map.set(row.serviceSlug, {
          slug: row.serviceSlug,
          label: row.serviceName,
          count: (existing?.count ?? 0) + 1,
        });
      });
    return Array.from(map.values()).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "ru"));
  }, [rows, activeSlugs]);

  // В категориях «заправка»/«замена» по сути показываем картриджи. Но если
  // у замены нет ни одной привязанной к картриджу цены — рендерим базовую
  // ставку в обычном «сервисном» виде, а не сломанной картриджной строкой.
  const isCartridgeCategoryRaw = category === "laser_refill" || category === "cartridge_replacement";
  const allCategoryRows = useMemo(
    () => rows.filter((row) => activeSlugs.has(row.serviceSlug)),
    [rows, activeSlugs],
  );
  const hasCartridgeRows = allCategoryRows.some((r) => r.cartridge);
  const isCartridgeCategory = isCartridgeCategoryRaw && hasCartridgeRows;

  const sectionRows = useMemo(
    () =>
      allCategoryRows.filter((row) => {
        // В картриджной категории прячем «фантомную» базовую услугу без модели.
        if (isCartridgeCategory && !row.cartridge) return false;
        // Струйные «картриджи» (чернила Epson 003/103/664 и т.п.) — это не наш
        // расходник: для струйки ведём услуги, не заправку. Скрываем их из
        // основной табличной выдачи прайса.
        if (isCartridgeCategory && row.cartridge?.type === "струйный") return false;
        return true;
      }),
    [allCategoryRows, isCartridgeCategory],
  );

  const showBrandFilter = isCartridgeCategory;

  const brands = useMemo(() => {
    if (!showBrandFilter) return [];
    const set = new Set<string>();
    sectionRows.forEach((r) => r.cartridge && set.add(r.cartridge.brand));
    return Array.from(set).sort();
  }, [sectionRows, showBrandFilter]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sectionRows
      .filter((r) => service === "all" || r.serviceSlug === service)
      .filter((r) => {
        if (!showBrandFilter || brandsOn.size === 0) return true;
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
          priceCategoryForSlug(r.serviceSlug).title,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
  }, [sectionRows, query, service, brandsOn, showBrandFilter]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const dir = sort.dir === "asc" ? 1 : -1;
      const av =
        sort.key === "amount"
          ? a.amount
          : sort.key === "yield"
            ? a.cartridge?.pageYield || 0
            : sort.key === "model"
              ? a.cartridge?.model || a.serviceName
              : a.cartridge?.brand || a.serviceName;
      const bv =
        sort.key === "amount"
          ? b.amount
          : sort.key === "yield"
            ? b.cartridge?.pageYield || 0
            : sort.key === "model"
              ? b.cartridge?.model || b.serviceName
              : b.cartridge?.brand || b.serviceName;
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv), "ru") * dir;
    });
    return arr;
  }, [filtered, sort]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const paged = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const isCartridgeView = isCartridgeCategory;
  const selectedService = service === "all" ? null : services.find((item) => item.slug === service);

  // Слушаем событие от финдера «принтер → картридж»: переключаем категорию
  // на нужную, сбрасываем фильтры и подставляем модель в поиск, чтобы
  // искомая строка точно оказалась в текущем срезе таблицы.
  useEffect(() => {
    function onFocusCartridge(e: Event) {
      const detail = (e as CustomEvent).detail as { brand?: string; model?: string } | undefined;
      if (!detail?.model) return;
      const targetRow = rows.find(
        (r) => r.cartridge && r.cartridge.brand === detail.brand && r.cartridge.model === detail.model,
      );
      const nextCategory = targetRow
        ? priceCategoryForSlug(targetRow.serviceSlug).id
        : "laser_refill";
      setCategory(nextCategory);
      setService("all");
      setBrandsOn(new Set());
      setSort({ key: "brand", dir: "asc" });
      setExpandedId(null);
      setPage(1);
      setQuery(detail.model);
    }
    window.addEventListener("printcare:price:focus-cartridge", onFocusCartridge as EventListener);
    return () => window.removeEventListener("printcare:price:focus-cartridge", onFocusCartridge as EventListener);
  }, [rows]);

  function resetForCategory(nextCategory: string) {
    setCategory(nextCategory);
    setService("all");
    setBrandsOn(new Set());
    setExpandedId(null);
    setPage(1);
  }

  function toggleBrand(b: string) {
    setBrandsOn((prev) => {
      const next = new Set(prev);
      if (next.has(b)) next.delete(b);
      else next.add(b);
      return next;
    });
    setPage(1);
  }

  function sortBy(key: Sort["key"]) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {categoryTabs.map((item) => {
          const active = category === item.id;
          return (
            <button
              key={item.id}
              id={item.id}
              type="button"
              onClick={() => resetForCategory(item.id)}
              className={`rounded-2xl border p-4 text-left transition ${
                active ? "border-primary bg-card shadow-sm" : "border-border bg-card/50 hover:border-primary/40 hover:bg-card"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium tracking-tight">{item.title}</div>
                  <div className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-fg">{item.hint}</div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-xs text-muted-fg">от</div>
                  <div className="font-semibold tabular-nums">{formatRub(item.from)}</div>
                </div>
              </div>
              <div className="mt-3 text-xs text-muted-fg">{fmtPositions(item.count)}</div>
            </button>
          );
        })}
      </div>

      <div className="rounded-3xl border border-border bg-card p-4 md:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-fg">Раздел прайса</div>
            <h3 className="mt-1 text-2xl font-semibold tracking-tight">{activeCategory?.title}</h3>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-fg">{activeCategory?.description}</p>
          </div>
          <div className="relative w-full lg:max-w-sm">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-fg" />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Модель, картридж или услуга"
              className="input h-12 w-full rounded-2xl border-border bg-bg pl-11 pr-4 text-base placeholder:text-muted-fg/80"
            />
          </div>
        </div>

        {services.length > 1 && (
          <div className="mt-5 flex flex-wrap gap-2">
            <FilterButton
              active={service === "all"}
              onClick={() => {
                setService("all");
                setPage(1);
              }}
            >
              Все услуги
            </FilterButton>
            {services.map((item) => (
              <FilterButton
                key={item.slug}
                active={service === item.slug}
                onClick={() => {
                  setService(item.slug);
                  setPage(1);
                }}
              >
                {item.label}
              </FilterButton>
            ))}
          </div>
        )}

        {brands.length > 0 && (
          <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border pt-4">
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
                      : "border-border bg-bg text-muted-fg hover:border-primary/40 hover:text-fg"
                  }`}
                >
                  {b}
                </button>
              );
            })}
            {brandsOn.size > 0 && (
              <button
                type="button"
                onClick={() => {
                  setBrandsOn(new Set());
                  setPage(1);
                }}
                className="text-xs text-muted-fg underline underline-offset-2 hover:text-fg"
              >
                сбросить
              </button>
            )}
          </div>
        )}
      </div>

      {isCartridgeView ? (
        <CartridgeRows
          rows={paged}
          total={sorted.length}
          sort={sort}
          expandedId={expandedId}
          onExpand={setExpandedId}
          onSort={sortBy}
        />
      ) : (
        <ServiceRows rows={paged} total={sorted.length} expandedId={expandedId} onExpand={setExpandedId} />
      )}

      <div className="flex flex-col items-center justify-between gap-3 text-xs text-muted-fg sm:flex-row">
        <div>
          Показано {sorted.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1}–
          {Math.min(currentPage * PAGE_SIZE, sorted.length)} из {sorted.length}
          {selectedService ? ` · ${selectedService.label}` : ""} · Цены ориентировочные, точная — на месте.
        </div>

        {pageCount > 1 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Назад"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="min-w-16 text-center text-sm">
              <span className="font-medium text-fg">{currentPage}</span> / {pageCount}
            </div>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              disabled={currentPage === pageCount}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Вперёд"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function CartridgeRows({
  rows,
  total,
  sort,
  expandedId,
  onExpand,
  onSort,
}: {
  rows: PriceRow[];
  total: number;
  sort: Sort;
  expandedId: string | null;
  onExpand: (id: string | null) => void;
  onSort: (key: Sort["key"]) => void;
}) {
  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-card">
      <div className="hidden grid-cols-[1fr,80px,120px,120px,32px] gap-3 border-b border-border bg-bg-2/70 px-5 py-3 text-xs font-medium uppercase tracking-wider text-muted-fg md:grid">
        <SortHead label="Картридж" k="brand" sort={sort} onClick={() => onSort("brand")} />
        <span className="text-center">Чип</span>
        <SortHead label="Ресурс" k="yield" sort={sort} onClick={() => onSort("yield")} align="right" />
        <SortHead label="Цена" k="amount" sort={sort} onClick={() => onSort("amount")} align="right" />
        <span />
      </div>

      <ul className="divide-y divide-border">
        {total === 0 && <EmptyState />}
        {rows.map((row) => {
          const c = row.cartridge;
          const expanded = expandedId === row.id;
          return (
            <li key={row.id}>
              <button
                type="button"
                onClick={() => onExpand(expanded ? null : row.id)}
                data-cartridge-key={c ? `${c.brand} ${c.model}` : ""}
                className="grid w-full gap-3 px-5 py-4 text-left transition-colors hover:bg-bg-2/60 md:grid-cols-[1fr,80px,120px,120px,32px] md:items-center"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="font-medium tracking-tight">{c ? `${c.brand} ${c.model}` : row.serviceName}</span>
                    <span className="text-xs text-muted-fg">{row.serviceName.toLowerCase()}</span>
                    {c?.isPopular && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-600">
                        <Star className="h-3 w-3" /> Хит
                      </span>
                    )}
                  </div>
                  {c?.compatible && <div className="mt-0.5 truncate text-xs text-muted-fg">{c.compatible}</div>}
                </div>

                <div className="hidden text-center text-xs md:block">
                  {c?.hasChip ? (
                    <span className="inline-flex items-center gap-1 text-amber-600">
                      <Zap className="h-3 w-3" /> чип
                    </span>
                  ) : (
                    <span className="text-muted-fg/60">—</span>
                  )}
                </div>

                <div className="hidden text-right text-sm tabular-nums text-muted-fg md:block">
                  {c?.type === "лазерный" ? formatYield(c?.pageYield) : "—"}
                </div>

                <div className="text-base font-semibold tabular-nums md:text-right">{formatRub(row.amount)}</div>
                <ChevronDown className={`hidden h-4 w-4 text-muted-fg transition md:block ${expanded ? "rotate-180" : ""}`} />
              </button>

              {expanded && <ExpandedCartridge row={row} />}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ServiceRows({
  rows,
  total,
  expandedId,
  onExpand,
}: {
  rows: PriceRow[];
  total: number;
  expandedId: string | null;
  onExpand: (id: string | null) => void;
}) {
  return (
    <div className="rounded-3xl border border-border bg-card">
      <ul className="divide-y divide-border">
        {total === 0 && <EmptyState />}
        {rows.map((row) => {
          const expanded = expandedId === row.id;
          const category = priceCategoryForSlug(row.serviceSlug);
          return (
            <li key={row.id}>
              <button
                type="button"
                onClick={() => onExpand(expanded ? null : row.id)}
                className="grid w-full gap-4 px-5 py-5 text-left transition-colors hover:bg-bg-2/60 md:grid-cols-[minmax(0,1fr),180px,32px] md:items-center"
              >
                <div className="flex min-w-0 gap-3">
                  <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-border bg-bg-2">
                    <Wrench className="h-4 w-4 text-muted-fg" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium tracking-tight">{row.serviceName}</div>
                    <div className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-fg">
                      {row.note || serviceDescription(row)}
                    </div>
                    <div className="mt-2 text-xs text-muted-fg">{category.title}</div>
                  </div>
                </div>

                <div className="md:text-right">
                  <div className="text-xs text-muted-fg">от</div>
                  <div className="text-xl font-semibold tabular-nums">{formatRub(row.amount)}</div>
                </div>
                <ChevronDown className={`hidden h-4 w-4 text-muted-fg transition md:block ${expanded ? "rotate-180" : ""}`} />
              </button>

              {expanded && (
                <div className="border-t border-border/60 bg-bg-2/40 px-5 py-4 text-sm text-muted-fg">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Fact icon={Wrench} label="Расчёт" value="по работе и сложности" />
                    <Fact icon={Layers} label="Техника" value={serviceAppliesTo(row)} />
                    <Fact icon={Star} label="Цена" value="точная после осмотра" />
                  </div>
                  <a
                    href="/#request"
                    className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-fg shadow-sm transition hover:opacity-90"
                  >
                    Заказать «{row.serviceName.toLowerCase()}»
                  </a>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ExpandedCartridge({ row }: { row: PriceRow }) {
  const c = row.cartridge;
  return (
    <div className="border-t border-border/60 bg-bg-2/40 px-5 py-4 text-sm text-muted-fg">
      <div className="grid gap-3 sm:grid-cols-3">
        <Fact icon={Layers} label="Тип" value={c?.type ? capitalize(c.type) : "—"} />
        <Fact icon={Zap} label="Чип" value={c?.hasChip ? "есть · +150 ₽ за замену" : "без чипа"} />
        <Fact icon={Star} label="Ресурс" value={c?.type === "лазерный" ? formatYield(c?.pageYield) : "Не применяется"} />
      </div>
      {c?.compatible && (
        <div className="mt-3">
          <div className="text-xs uppercase tracking-wider">Подходит к принтерам</div>
          <div className="mt-1 text-fg">{c.compatible}</div>
        </div>
      )}
      {row.note && <div className="mt-3 text-xs text-muted-fg">{row.note}</div>}
      <a
        href="/#request"
        className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-fg shadow-sm transition hover:opacity-90"
      >
        Заказать «{row.serviceName.toLowerCase()}»
      </a>
    </div>
  );
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-2 text-sm transition-colors ${
        active ? "border-primary bg-primary/10 text-primary" : "border-border bg-bg text-muted-fg hover:border-primary/40 hover:text-fg"
      }`}
    >
      {children}
    </button>
  );
}

function SortHead({
  label,
  k,
  sort,
  onClick,
  align = "left",
}: {
  label: string;
  k: Sort["key"];
  sort: Sort;
  onClick: () => void;
  align?: "left" | "right";
}) {
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

function EmptyState() {
  return (
    <li className="px-5 py-12 text-center text-sm text-muted-fg">
      Ничего не нашли. Уточните модель, картридж или услугу.
    </li>
  );
}

function serviceDescription(row: PriceRow) {
  const text: Record<string, string> = {
    diagnostika: "Проверим состояние техники и согласуем дальнейшие работы.",
    remont: "Ремонтируем узел, из-за которого принтер плохо печатает или не работает.",
    "head-cleaning": "Помогает при полосах, пропусках цвета и подсохшей печатающей головке.",
    "head-flush": "Глубокая промывка при сильном засоре печатающей головки.",
    "ciss-service": "Настройка и обслуживание системы непрерывной подачи чернил.",
    "ciss-install": "Установка СНПЧ с проверкой стабильной подачи чернил.",
    "waste-ink-reset": "Работа с памперсом или абсорбером после диагностики состояния.",
    "ink-system-service": "Обслуживание узлов подачи чернил без отдельной заправки струйного принтера.",
    "inkjet-diagnostics": "Проверка струйного принтера, головки, подачи бумаги и качества печати.",
    "inkjet-repair": "Ремонт струйной техники по неисправности и модели принтера.",
    "print-quality-setup": "Калибровка и настройка качества печати.",
    "paper-feed": "Устранение проблем с захватом, перекосом и замятием бумаги.",
  };
  return text[row.serviceSlug] ?? "Стоимость зависит от модели и состояния техники.";
}

function serviceAppliesTo(row: PriceRow) {
  if (row.serviceSlug.includes("inkjet") || row.serviceSlug.includes("ciss") || row.serviceSlug.includes("head")) {
    return "струйная печать";
  }
  if (row.serviceSlug === "remont" || row.serviceSlug === "paper-feed") return "лазерная и струйная";
  return "по ситуации";
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
