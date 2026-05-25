"use client";

import { useEffect, useRef, useState } from "react";
import { Search, Printer, Zap, ArrowRight } from "lucide-react";

/**
 * Поиск картриджей по модели принтера на публичной странице прайса.
 * Клиент вводит модель ("HP M404", "L3150", "Canon MF237"), мы дёргаем
 * /api/public/cartridges-for-printer и показываем список подходящих
 * картриджей. По клику — скроллим к строке в каталоге.
 */
type FoundCartridge = { brand: string; model: string; hasChip: boolean };
type Found = {
  printer: { brand: string; family: string; kind?: string | null; chipNote?: string | null } | null;
  cartridges: FoundCartridge[];
};

export function PrinterCartridgeFinder() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<Found | null>(null);
  const [loading, setLoading] = useState(false);
  const [missed, setMissed] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResult(null);
      setMissed(false);
      return;
    }
    const ctrl = new AbortController();
    abortRef.current?.abort();
    abortRef.current = ctrl;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/public/cartridges-for-printer?q=${encodeURIComponent(q)}`, {
          signal: ctrl.signal,
        });
        const data: Found = await res.json();
        setResult(data);
        setMissed(!data.printer);
      } catch (e: any) {
        if (e?.name !== "AbortError") setResult(null);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query]);

  function scrollToCartridge(c: FoundCartridge) {
    // PriceCatalog рендерит карточки картриджей — попадаем в строку по тексту «Бренд Модель».
    const needle = `${c.brand} ${c.model}`.toLowerCase();
    const buttons = document.querySelectorAll<HTMLButtonElement>("[data-cartridge-key]");
    for (const btn of buttons) {
      if ((btn.dataset.cartridgeKey || "").toLowerCase() === needle) {
        btn.scrollIntoView({ behavior: "smooth", block: "center" });
        btn.classList.add("ring-2", "ring-primary");
        setTimeout(() => btn.classList.remove("ring-2", "ring-primary"), 2000);
        return;
      }
    }
  }

  return (
    <div className="rounded-3xl border border-border bg-card p-5 lg:p-7">
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Printer className="h-6 w-6" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-semibold tracking-tight">Не знаете, какой картридж?</h2>
          <p className="mt-1 text-sm text-muted-fg">
            Введите модель принтера — мы подскажем, какие картриджи к нему подходят, и сразу покажем цену заправки.
          </p>
          <div className="relative mt-4">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-fg" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Например: HP LaserJet M404, Canon MF237, Epson L3150…"
              className="input h-12 w-full rounded-2xl border-border bg-bg-2 pl-11 pr-4 text-base"
              autoComplete="off"
            />
          </div>

          {/* Результаты */}
          {result?.printer && result.cartridges.length > 0 && (
            <div className="mt-4 rounded-2xl border border-border bg-bg-2 p-4">
              <div className="text-xs uppercase tracking-wider text-muted-fg">Найдено</div>
              <div className="mt-1 font-semibold">
                {result.printer.brand} {result.printer.family}
                {result.printer.kind && (
                  <span className="ml-2 text-xs font-normal text-muted-fg">· {result.printer.kind}</span>
                )}
              </div>
              {result.printer.chipNote && (
                <div className="mt-1 text-xs text-muted-fg">{result.printer.chipNote}</div>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {result.cartridges.map((c) => (
                  <button
                    key={`${c.brand}-${c.model}`}
                    type="button"
                    onClick={() => scrollToCartridge(c)}
                    className="group inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-medium transition hover:border-primary hover:text-primary"
                    title="Найти в прайсе ниже"
                  >
                    {c.brand} {c.model}
                    {c.hasChip && <Zap className="h-3 w-3 text-amber-500" />}
                    <ArrowRight className="h-3 w-3 opacity-50 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {loading && query.length >= 2 && !result?.printer && (
            <div className="mt-3 text-xs text-muted-fg">ищем модель…</div>
          )}
          {missed && !loading && query.length >= 2 && (
            <div className="mt-3 rounded-2xl border border-dashed border-border px-4 py-3 text-sm text-muted-fg">
              Не нашли в каталоге.{" "}
              <a href="/#request" className="text-primary underline-offset-2 hover:underline">
                Оставьте заявку
              </a>{" "}
              — подберём вручную за 15 минут.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
