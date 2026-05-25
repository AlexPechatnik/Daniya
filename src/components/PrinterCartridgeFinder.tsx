"use client";

import { useEffect, useRef, useState } from "react";
import { Search, Printer, Zap, ArrowRight, X, Droplet, Info } from "lucide-react";
import { formatRub } from "@/lib/utils";

/**
 * Главный инструмент страницы прайса: клиент пишет модель принтера —
 * получает подходящие картриджи. По клику чипа — плавно скроллит
 * к строке в каталоге и подсвечивает её.
 *
 * UX в духе Apple HIG:
 *  • один поисковый инпут, focus-приоритет;
 *  • автокомплит подсказывает модели по мере ввода;
 *  • найденная модель — крупно, картриджи — большими кликабельными чипами;
 *  • если не нашли — мягкая ссылка на форму заявки, без жирного CTA.
 */
type FoundCartridge = { brand: string; model: string; hasChip: boolean };
type FoundService = { slug: string; name: string; fromAmount: number | null };
type Found = {
  printer: { brand: string; family: string; kind?: string | null; chipNote?: string | null } | null;
  printType: "laser" | "inkjet" | null;
  cartridges: FoundCartridge[];
  services: FoundService[];
  pricingNote?: string;
};

type Suggestion = { value: string; title: string; subtitle?: string; kind?: string };

export function PrinterCartridgeFinder() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<Found | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggest, setShowSuggest] = useState(false);
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState(false);
  const findCtrl = useRef<AbortController | null>(null);
  const sugCtrl = useRef<AbortController | null>(null);

  // Подсказки моделей принтеров — реальные имена из каталога
  useEffect(() => {
    if (!touched) return;
    const q = query.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setShowSuggest(false);
      return;
    }
    sugCtrl.current?.abort();
    const ctrl = new AbortController();
    sugCtrl.current = ctrl;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/public/suggest/printers?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        const data = await res.json();
        const next: Suggestion[] = data.suggestions || [];
        setSuggestions(next);
        setShowSuggest(next.length > 0);
      } catch (e: any) {
        if (e?.name !== "AbortError") setSuggestions([]);
      }
    }, 160);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query, touched]);

  // Поиск картриджей по введённой строке — основной запрос
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResult(null);
      return;
    }
    findCtrl.current?.abort();
    const ctrl = new AbortController();
    findCtrl.current = ctrl;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/public/cartridges-for-printer?q=${encodeURIComponent(q)}`, {
          signal: ctrl.signal,
        });
        const data: Found = await res.json();
        setResult(data);
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
    // Каталог слушает событие и сам переключает категорию + фильтрует.
    window.dispatchEvent(
      new CustomEvent("printcare:price:focus-cartridge", { detail: { brand: c.brand, model: c.model } }),
    );
    // Пробуем сразу проскроллить — каталог может ещё перерисовываться, поэтому
    // даём ему 2 кадра, после чего ищем строку и подсвечиваем.
    const tries = [120, 360, 700];
    const needle = `${c.brand} ${c.model}`.toLowerCase();
    tries.forEach((delay) =>
      setTimeout(() => {
        const btn = [...document.querySelectorAll<HTMLButtonElement>("[data-cartridge-key]")]
          .find((b) => (b.dataset.cartridgeKey || "").toLowerCase() === needle);
        if (btn) {
          btn.scrollIntoView({ behavior: "smooth", block: "center" });
          btn.classList.add("ring-2", "ring-primary");
          setTimeout(() => btn.classList.remove("ring-2", "ring-primary"), 1800);
        }
      }, delay),
    );
  }

  function pickSuggestion(s: Suggestion) {
    setQuery(s.value);
    setShowSuggest(false);
  }

  const showMiss = !loading && query.trim().length >= 2 && result && !result.printer;
  const showLaserHit = result?.printer && result.printType === "laser" && result.cartridges.length > 0;
  const showInkjetHit = result?.printer && result.printType === "inkjet";

  return (
    <div className="rounded-3xl border border-border bg-card p-6 lg:p-8">
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Printer className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-semibold tracking-tight">Подобрать картридж по принтеру</h2>
          <p className="mt-1 text-sm text-muted-fg">
            Введите модель — подскажем подходящие картриджи и сразу покажем цену заправки.
          </p>

          {/* Поле + автокомплит */}
          <div className="relative mt-5">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-fg" />
            <input
              value={query}
              onChange={(e) => {
                setTouched(true);
                setQuery(e.target.value);
              }}
              onFocus={() => {
                if (touched && suggestions.length > 0) setShowSuggest(true);
              }}
              onBlur={() => window.setTimeout(() => setShowSuggest(false), 120)}
              placeholder="HP LaserJet M404, Canon MF237, Epson L3150…"
              className="input h-12 w-full rounded-2xl border-border bg-bg-2 pl-11 pr-10 text-base placeholder:text-muted-fg/80"
              autoComplete="off"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setResult(null);
                  setSuggestions([]);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-fg hover:bg-muted/40 hover:text-fg"
                aria-label="Очистить"
              >
                <X className="h-4 w-4" />
              </button>
            )}

            {/* Выпадающий список подсказок моделей */}
            {showSuggest && suggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 max-h-72 overflow-y-auto rounded-2xl border border-border bg-card shadow-xl shadow-black/10">
                {suggestions.map((s) => (
                  <button
                    key={`${s.kind || ""}:${s.value}`}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pickSuggestion(s)}
                    className="block w-full border-b border-border/60 px-4 py-2.5 text-left last:border-b-0 hover:bg-bg-2/60"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium">{s.title}</span>
                      {s.kind && (
                        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-fg">
                          {s.kind}
                        </span>
                      )}
                    </div>
                    {s.subtitle && <div className="mt-0.5 text-xs text-muted-fg">{s.subtitle}</div>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Лазерный результат: модель + чипы картриджей */}
          {showLaserHit && (
            <div className="mt-5 rounded-2xl border border-border bg-bg-2 p-4">
              <div className="text-xs uppercase tracking-wider text-muted-fg">Найдено · лазерный</div>
              <div className="mt-1 font-semibold">
                {result!.printer!.brand} {result!.printer!.family}
                {result!.printer!.kind && (
                  <span className="ml-2 text-xs font-normal text-muted-fg">· {result!.printer!.kind}</span>
                )}
              </div>
              {result!.printer!.chipNote && (
                <div className="mt-1 text-xs text-muted-fg">{result!.printer!.chipNote}</div>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                {result!.cartridges.map((c) => (
                  <button
                    key={`${c.brand}-${c.model}`}
                    type="button"
                    onClick={() => scrollToCartridge(c)}
                    className="group inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-2 text-sm font-medium transition hover:border-primary hover:text-primary"
                    title="Найти в таблице ниже"
                  >
                    {c.brand} {c.model}
                    {c.hasChip && <Zap className="h-3 w-3 text-amber-500" />}
                    <ArrowRight className="h-3.5 w-3.5 opacity-50 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Струйный результат: услуги (без чернил), цена «от» и уточнение */}
          {showInkjetHit && (
            <div className="mt-5 rounded-2xl border border-sky-500/30 bg-sky-500/[0.06] p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-sky-600 dark:text-sky-400">
                <Droplet className="h-3.5 w-3.5" /> Найдено · струйный
              </div>
              <div className="mt-1 font-semibold">
                {result!.printer!.brand} {result!.printer!.family}
                {result!.printer!.kind && (
                  <span className="ml-2 text-xs font-normal text-muted-fg">· {result!.printer!.kind}</span>
                )}
              </div>
              {result!.pricingNote && (
                <div className="mt-2 flex items-start gap-1.5 text-xs text-muted-fg leading-relaxed">
                  <Info className="mt-0.5 h-3 w-3 shrink-0" />
                  <span>{result!.pricingNote}</span>
                </div>
              )}
              <div className="mt-4 grid gap-1.5 sm:grid-cols-2">
                {result!.services.slice(0, 6).map((s) => (
                  <a
                    key={s.slug}
                    href="/#request"
                    onClick={() => {
                      // Передаём подсказку форме: модель + рекомендуемая услуга.
                      try {
                        sessionStorage.setItem(
                          "printcare:inkjet:request",
                          JSON.stringify({
                            printer: `${result!.printer!.brand} ${result!.printer!.family}`,
                            serviceSlug: s.slug,
                            serviceName: s.name,
                            ts: Date.now(),
                          }),
                        );
                        window.dispatchEvent(new CustomEvent("printcare:inkjet:apply"));
                      } catch {}
                    }}
                    className="group flex items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm transition hover:border-primary hover:text-primary"
                  >
                    <span className="truncate">{s.name}</span>
                    <span className="shrink-0 text-xs text-muted-fg group-hover:text-primary">
                      {s.fromAmount ? `от ${formatRub(s.fromAmount)}` : "уточнить"}
                    </span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Loading-индикатор — деликатный, не дёргает раскладку */}
          {loading && !showLaserHit && !showInkjetHit && query.trim().length >= 2 && (
            <div className="mt-3 text-xs text-muted-fg">ищем модель…</div>
          )}

          {/* Не нашли — мягкий fallback, ссылка, не громкий CTA */}
          {showMiss && (
            <div className="mt-4 text-sm text-muted-fg">
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
