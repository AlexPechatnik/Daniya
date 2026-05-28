"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search, X } from "lucide-react";

/**
 * Селектор услуги с двумя видами:
 *
 *  Десктоп (lg+) — сетка-плитки как раньше (контекста и места достаточно).
 *  Мобайл (< lg) — iOS-style: компактная кнопка с текущей услугой → bottom-sheet
 *                  с поиском и группировкой по категориям. Закрывается на выбор.
 *
 * Категории показываются заголовками; пилюли цветной полоской слева как маркер.
 */

export type ServiceOption = {
  value: string;
  label: string;
  hint?: string;
  category?: string | null;
};

/** Карта slug-категории → цвет (та же, что в ChoiceGrid). */
const CATEGORY_BAR: Record<string, string> = {
  laser_refill: "bg-blue-500",
  cartridge_replacement: "bg-indigo-500",
  ciss_inkjet_service: "bg-purple-500",
  printer_repair: "bg-orange-500",
  visit_diagnostics: "bg-teal-500",
  maintenance: "bg-slate-400",
};

const CATEGORY_TITLES: Record<string, string> = {
  laser_refill: "Лазерные картриджи",
  cartridge_replacement: "Замена картриджа",
  ciss_inkjet_service: "Струйный сервис",
  printer_repair: "Ремонт принтеров",
  visit_diagnostics: "Диагностика",
  maintenance: "Прочее",
};

export function ServicePicker({
  items,
  value,
  onChange,
}: {
  items: ServiceOption[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <>
      <div className="lg:hidden">
        <MobilePicker items={items} value={value} onChange={onChange} />
      </div>
      <div className="hidden lg:block">
        <DesktopGrid items={items} value={value} onChange={onChange} />
      </div>
    </>
  );
}

/* ════════ Mobile: button → bottom sheet ════════ */

function MobilePicker({
  items,
  value,
  onChange,
}: {
  items: ServiceOption[];
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = items.find((i) => i.value === value) ?? items[0];
  const bar = current?.category ? CATEGORY_BAR[current.category] || "bg-muted" : "bg-muted";
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative w-full overflow-hidden rounded-2xl border border-border bg-bg-2 px-5 py-3 text-left transition active:bg-muted/40"
      >
        <span className={`absolute left-0 top-0 bottom-0 w-1 ${bar}`} aria-hidden />
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wider text-muted-fg">Текущая услуга</div>
            <div className="mt-0.5 truncate text-sm font-medium">{current?.label || "Не выбрана"}</div>
            {current?.hint && <div className="mt-0.5 truncate text-xs text-muted-fg">{current.hint}</div>}
          </div>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-fg" />
        </div>
      </button>
      {open && (
        <ServiceSheet
          items={items}
          value={value}
          onPick={(v) => {
            onChange(v);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function ServiceSheet({
  items,
  value,
  onPick,
  onClose,
}: {
  items: ServiceOption[];
  value: string;
  onPick: (value: string) => void;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState("");
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Группировка по категории + фильтр поиска
  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? items.filter((i) => i.label.toLowerCase().includes(q) || (i.hint || "").toLowerCase().includes(q))
      : items;
    const map = new Map<string, ServiceOption[]>();
    for (const item of filtered) {
      const cat = item.category || "_other";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(item);
    }
    // Сортировка категорий — известные сначала, в порядке как в CATEGORY_TITLES
    const order = Object.keys(CATEGORY_TITLES);
    const entries = [...map.entries()].sort(([a], [b]) => {
      const ia = order.indexOf(a);
      const ib = order.indexOf(b);
      if (ia === -1 && ib === -1) return a.localeCompare(b);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
    return entries;
  }, [items, query]);

  if (!mounted) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Выбор услуги"
      onClick={onClose}
      className="fixed inset-0 z-[110] flex items-end justify-center bg-black/55 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[88vh] w-full flex-col rounded-t-3xl bg-card shadow-2xl ring-1 ring-border"
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-2.5 pb-1">
          <div className="h-1.5 w-12 rounded-full bg-muted-fg/30" />
        </div>

        {/* Header + search */}
        <div className="sticky top-0 z-10 border-b border-border bg-card/95 px-4 pb-3 pt-2 backdrop-blur">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold">Выбрать услугу</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Закрыть"
              className="rounded-full p-1.5 text-muted-fg hover:bg-muted/40 hover:text-fg"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="relative mt-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-fg" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Найти услугу…"
              className="input h-10 w-full pl-10 pr-3 text-sm"
            />
          </div>
        </div>

        {/* Grouped list */}
        <div className="flex-1 overflow-y-auto px-2 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-2">
          {grouped.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-muted-fg">
              Ничего не нашли. Попробуйте другое слово.
            </div>
          ) : (
            grouped.map(([cat, options]) => (
              <div key={cat} className="mb-3">
                <div className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-fg">
                  {CATEGORY_TITLES[cat] || "Прочее"}
                </div>
                <ul className="overflow-hidden rounded-2xl border border-border bg-card divide-y divide-border">
                  {options.map((opt) => {
                    const selected = opt.value === value;
                    const bar = opt.category ? CATEGORY_BAR[opt.category] || "bg-muted" : "bg-muted";
                    return (
                      <li key={opt.value || "_empty"}>
                        <button
                          type="button"
                          onClick={() => onPick(opt.value)}
                          className="relative flex w-full items-start gap-3 px-4 py-3 text-left transition active:bg-muted/40"
                        >
                          <span className={`absolute left-0 top-0 bottom-0 w-1 ${bar}`} aria-hidden />
                          <div className="min-w-0 flex-1 pl-1">
                            <div className={`text-sm ${selected ? "font-semibold text-primary" : "font-medium"}`}>
                              {opt.label}
                            </div>
                            {opt.hint && (
                              <div className="mt-0.5 text-xs text-muted-fg">{opt.hint}</div>
                            )}
                          </div>
                          {selected && <Check className="h-4 w-4 shrink-0 text-primary" />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ════════ Desktop: grid, как было ════════ */

function DesktopGrid({
  items,
  value,
  onChange,
}: {
  items: ServiceOption[];
  value: string;
  onChange: (value: string) => void;
}) {
  const sorted = [...items].sort((a, b) => {
    const ca = a.category || "z_other";
    const cb = b.category || "z_other";
    if (ca !== cb) return ca.localeCompare(cb);
    return a.label.localeCompare(b.label, "ru");
  });
  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {sorted.map((item) => {
        const active = value === item.value;
        const bar = item.category ? CATEGORY_BAR[item.category] || "bg-muted" : "bg-muted";
        return (
          <button
            key={item.value || "empty"}
            type="button"
            onClick={() => onChange(item.value)}
            className={`relative min-h-[76px] overflow-hidden rounded-2xl border pl-5 pr-4 py-3 text-left transition ${
              active
                ? "border-primary/40 bg-primary/[0.06] shadow-sm"
                : "border-border bg-bg-2 hover:bg-muted hover:border-primary/20"
            }`}
          >
            <span className={`absolute left-0 top-0 bottom-0 w-1 ${bar}`} aria-hidden />
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-medium">{item.label}</div>
                {item.hint && <div className="mt-1 text-xs text-muted-fg">{item.hint}</div>}
              </div>
              {active && <Check className="h-4 w-4 shrink-0 text-primary" />}
            </div>
          </button>
        );
      })}
    </div>
  );
}
