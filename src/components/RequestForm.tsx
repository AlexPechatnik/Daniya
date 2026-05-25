"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { submitLead, type LeadFormState, getUpcomingHolidays } from "@/app/actions";
import { CheckCircle2, ArrowRight, CalendarOff, Calculator as CalcIcon, X, Droplet, Info } from "lucide-react";
import { Reveal } from "./Reveal";
import { format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import { AutocompleteInput } from "./crm/AutocompleteInput";
import { CALCULATOR_CART_KEY } from "./Calculator";
import { formatRub } from "@/lib/utils";

const services = [
  { value: "REFILL", label: "Заправка" },
  { value: "REPLACE", label: "Замена" },
  { value: "DIAGNOSTIC", label: "Диагностика" },
  { value: "REPAIR", label: "Ремонт" },
];

type CartridgeHint = { brand: string; model: string; hasChip: boolean };
type InkjetService = { slug: string; name: string; fromAmount: number | null };
type FinderResponse = {
  printer: { brand: string; family: string; kind?: string | null } | null;
  printType: "laser" | "inkjet" | null;
  cartridges: CartridgeHint[];
  services: InkjetService[];
  pricingNote?: string;
};

type CalculatorItem = {
  brand: string;
  model: string;
  serviceName: string;
  serviceKind: string;
  quantity: number;
  withChip: boolean;
  total: number; // копейки
};
type CalculatorPayload = { items: CalculatorItem[]; subtotal: number; ts: number };

export function RequestForm() {
  const [state, formAction, pending] = useActionState<LeadFormState, FormData>(submitLead, {});
  const [holidays, setHolidays] = useState<{ date: string; reason: string }[]>([]);
  const [address, setAddress] = useState("Санкт-Петербург, ");
  const [printer, setPrinter] = useState("");
  const [cartridge, setCartridge] = useState("");
  const [comment, setComment] = useState("");
  const [serviceKind, setServiceKind] = useState("REFILL");
  const [hints, setHints] = useState<CartridgeHint[]>([]);
  const [hintsLoading, setHintsLoading] = useState(false);
  const [fromCalc, setFromCalc] = useState<CalculatorPayload | null>(null);
  // Inkjet-режим: когда введён струйный принтер, прячем поле «Картридж»,
  // показываем список услуг струйного сервиса и пометку про уточнение цены.
  const [inkjet, setInkjet] = useState<FinderResponse | null>(null);
  // Slug выбранной услуги (для inkjet) — передаётся в action.
  const [serviceSlug, setServiceSlug] = useState<string | null>(null);
  const userTouchedComment = useRef(false);
  const userTouchedCartridge = useRef(false);

  // Чтение корзины калькулятора: предзаполняет картридж, услугу и
  // собирает в комментарий читаемую сводку. Срабатывает на маунте и
  // на event 'printcare:calculator:apply' (когда корзину сохранили
  // только что и мы прямо сейчас на странице).
  useEffect(() => {
    function applyFromStorage() {
      let raw: string | null = null;
      try {
        raw = sessionStorage.getItem(CALCULATOR_CART_KEY);
      } catch {
        return;
      }
      if (!raw) return;
      let payload: CalculatorPayload | null = null;
      try {
        payload = JSON.parse(raw);
      } catch {
        sessionStorage.removeItem(CALCULATOR_CART_KEY);
        return;
      }
      if (!payload?.items?.length) return;
      setFromCalc(payload);
      const first = payload.items[0];
      setCartridge(`${first.brand} ${first.model}`);
      setServiceKind(first.serviceKind || "REFILL");
      // В комментарий аккуратно собираем что выбрано, чтобы мастер видел всё
      if (!userTouchedComment.current) {
        const lines = payload.items.map((it) => {
          const qty = it.quantity > 1 ? ` × ${it.quantity}` : "";
          const chip = it.withChip ? " · с заменой чипа" : "";
          return `• ${it.brand} ${it.model}${qty} — ${it.serviceName.toLowerCase()}${chip} · ${formatRub(it.total)}`;
        });
        const summary = `Из калькулятора:\n${lines.join("\n")}\nИтого ориентировочно: ${formatRub(payload.subtotal)}`;
        setComment(summary);
      }
      // Сразу же удаляем — повторное открытие страницы не должно дублировать
      sessionStorage.removeItem(CALCULATOR_CART_KEY);
    }
    applyFromStorage();
    window.addEventListener("printcare:calculator:apply", applyFromStorage);
    return () => window.removeEventListener("printcare:calculator:apply", applyFromStorage);
  }, []);

  // Передача из inkjet-блока на странице прайса: туда нажали «услугу»,
  // тут подставляем принтер + предлагаемую услугу.
  useEffect(() => {
    function applyInkjet() {
      let raw: string | null = null;
      try { raw = sessionStorage.getItem("printcare:inkjet:request"); } catch { return; }
      if (!raw) return;
      try {
        const data = JSON.parse(raw) as { printer: string; serviceSlug: string; serviceName: string };
        setPrinter(data.printer);
        setServiceSlug(data.serviceSlug);
        setServiceKind("DIAGNOSTIC");
        if (!userTouchedComment.current) {
          setComment(`Струйный принтер: ${data.printer}. Запрос — ${data.serviceName.toLowerCase()}.`);
        }
        sessionStorage.removeItem("printcare:inkjet:request");
      } catch {
        sessionStorage.removeItem("printcare:inkjet:request");
      }
    }
    applyInkjet();
    window.addEventListener("printcare:inkjet:apply", applyInkjet);
    return () => window.removeEventListener("printcare:inkjet:apply", applyInkjet);
  }, []);

  // Подтягиваем подходящие картриджи или режим струйного сервиса по введённой
  // модели принтера. Для inkjet картриджи в форме не нужны — показываем услуги.
  useEffect(() => {
    const q = printer.trim();
    if (q.length < 2) {
      setHints([]);
      setInkjet(null);
      return;
    }
    const controller = new AbortController();
    const t = setTimeout(async () => {
      setHintsLoading(true);
      try {
        const res = await fetch(`/api/public/cartridges-for-printer?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        const data: FinderResponse = await res.json();
        if (data.printType === "inkjet") {
          setInkjet(data);
          setHints([]);
          // Авто-подсказка: выставим slug первой услуги (диагностика).
          if (data.services[0] && !serviceSlug) setServiceSlug(data.services[0].slug);
          // Дропдаун «Услуга» переключим в DIAGNOSTIC — он ближайший по смыслу
          // из «крупных» категорий; точная услуга при этом передаётся через serviceSlug.
          setServiceKind("DIAGNOSTIC");
          // Сбрасываем картриджное поле, если клиент его не правил
          if (!userTouchedCartridge.current) setCartridge("");
        } else {
          setInkjet(null);
          setHints(data.cartridges || []);
        }
      } catch (e: any) {
        if (e?.name !== "AbortError") {
          setHints([]);
          setInkjet(null);
        }
      } finally {
        setHintsLoading(false);
      }
    }, 350);
    return () => { clearTimeout(t); controller.abort(); };
  }, [printer]);

  useEffect(() => { getUpcomingHolidays().then(setHolidays); }, []);
  const nearHolidays = holidays.slice(0, 4);

  if (state.ok) {
    return (
      <section id="request" className="container py-20 lg:py-28">
        <Reveal>
          <div className="card glass max-w-2xl mx-auto p-10 lg:p-14 text-center">
            <div className="inline-flex h-16 w-16 rounded-2xl bg-success/15 border border-success/30 items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-success" />
            </div>
            <h2 className="heading-display mt-6 text-3xl md:text-4xl">Заявка принята</h2>
            <p className="mt-3 text-muted-fg">Мастер свяжется с вами в ближайшее время для подтверждения времени выезда.</p>
          </div>
        </Reveal>
      </section>
    );
  }

  return (
    <section id="request" className="relative py-20 lg:py-28 overflow-hidden">
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[300px] w-[600px] bg-primary/15 blur-[120px]" />
      </div>
      <div className="container relative">
        <div className="grid gap-12 lg:grid-cols-2 items-start">
          <Reveal>
            <div className="chip mb-4"><span className="font-mono text-primary">05</span> Связаться</div>
            <h2 className="heading-display text-4xl md:text-5xl lg:text-6xl">
              Оставьте номер —<br /><span className="text-gradient">перезвоним за 15 минут</span>
            </h2>
            <p className="mt-5 text-muted-fg max-w-md leading-relaxed">
              Уточним детали, согласуем удобное время, привезём всё необходимое. Без навязчивых звонков «через неделю напомнить о себе».
            </p>
            <ul className="mt-8 space-y-3 text-sm">
              {[
                "Бесплатный выезд по СПб от 1 500 ₽",
                "Оплата наличными, картой или счёт для юр.лиц",
                "Можем приехать сегодня",
              ].map((b) => (
                <li key={b} className="flex items-center gap-3">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" /> {b}
                </li>
              ))}
            </ul>
            {nearHolidays.length > 0 && (
              <div className="mt-6 rounded-xl border border-warning/30 bg-warning/[0.06] p-4">
                <div className="flex items-center gap-2 text-warning text-sm font-medium">
                  <CalendarOff className="h-4 w-4" />
                  Ближайшие нерабочие дни
                </div>
                <ul className="mt-2 text-xs text-warning/80 space-y-1">
                  {nearHolidays.map((h) => (
                    <li key={h.date}>{format(parseISO(h.date), "d MMMM, EEEE", { locale: ru })} — {h.reason}</li>
                  ))}
                </ul>
              </div>
            )}
          </Reveal>

          <Reveal delay={0.1}>
            <form action={formAction} className="card glass p-6 lg:p-8 space-y-4 relative overflow-hidden">
              <div className="absolute -top-px -left-px -right-px h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Имя"><input name="name" required className="input" placeholder="Как обращаться" /></Field>
                <Field label="Телефон"><input name="phone" required className="input" placeholder="+7 (___) ___-__-__" type="tel" /></Field>
              </div>
              <Field label="Адрес выезда">
                <AutocompleteInput
                  endpoint="/api/public/suggest/addresses"
                  value={address}
                  onChange={setAddress}
                  placeholder="Город, улица, дом, офис"
                  minLength={3}
                  name="address"
                  className="input"
                />
              </Field>
              {/* Баннер о том, что данные пришли из калькулятора — Apple HIG: continuity. */}
              {fromCalc && (
                <div className="rounded-xl border border-primary/30 bg-primary/[0.06] p-3 text-xs">
                  <div className="flex items-start gap-2.5">
                    <CalcIcon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <div className="flex-1 leading-relaxed">
                      <div className="font-medium text-fg">
                        Из калькулятора подставлено: {fromCalc.items.length} {fromCalc.items.length === 1 ? "позиция" : "позиций"}
                        {" · "}итого ≈ {formatRub(fromCalc.subtotal)}
                      </div>
                      <div className="mt-0.5 text-muted-fg">
                        Картридж и услуга предзаполнены, остальное — в комментарии.
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setFromCalc(null);
                        setCartridge("");
                        setComment("");
                        userTouchedComment.current = false;
                      }}
                      className="rounded-full p-1 text-muted-fg hover:bg-muted/40 hover:text-fg"
                      aria-label="Сбросить данные калькулятора"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Услуга">
                  <select
                    name="serviceKind"
                    value={serviceKind}
                    onChange={(e) => setServiceKind(e.target.value)}
                    className="input"
                  >
                    {services.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </Field>
                <Field label="Модель принтера">
                  <AutocompleteInput
                    endpoint="/api/public/suggest/printers"
                    value={printer}
                    onChange={setPrinter}
                    placeholder="HP M404, Canon LBP6020, Epson L3100…"
                    minLength={2}
                    name="printer"
                    className="input"
                  />
                </Field>
              </div>
              {/* Скрытое поле slug услуги — для inkjet передаётся конкретная услуга
                  (диагностика/чистка/СНПЧ), не общий REFILL/DIAGNOSTIC. */}
              {serviceSlug && <input type="hidden" name="serviceSlug" value={serviceSlug} />}

              {inkjet ? (
                <div className="rounded-xl border border-sky-500/30 bg-sky-500/[0.06] p-4">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-sky-600 dark:text-sky-400">
                    <Droplet className="h-3.5 w-3.5" /> Струйный принтер
                  </div>
                  <div className="mt-1 text-sm font-medium">
                    {inkjet.printer?.brand} {inkjet.printer?.family}
                    {inkjet.printer?.kind && (
                      <span className="ml-2 text-xs font-normal text-muted-fg">· {inkjet.printer.kind}</span>
                    )}
                  </div>
                  {inkjet.pricingNote && (
                    <div className="mt-2 flex items-start gap-1.5 text-xs text-muted-fg leading-relaxed">
                      <Info className="mt-0.5 h-3 w-3 shrink-0" />
                      <span>{inkjet.pricingNote}</span>
                    </div>
                  )}
                  <div className="mt-3 text-xs uppercase tracking-wider text-muted-fg">Тип работ</div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {inkjet.services.map((s) => {
                      const active = serviceSlug === s.slug;
                      return (
                        <button
                          key={s.slug}
                          type="button"
                          onClick={() => setServiceSlug(s.slug)}
                          className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                            active
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border bg-card hover:border-primary/40 hover:text-fg"
                          }`}
                        >
                          {s.name}
                          <span className="ml-1.5 text-[10px] text-muted-fg">
                            {s.fromAmount ? `от ${formatRub(s.fromAmount)}` : "уточнить"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <Field label="Картридж (если знаете)">
                  <input
                    name="cartridge"
                    value={cartridge}
                    onChange={(e) => {
                      userTouchedCartridge.current = true;
                      setCartridge(e.target.value);
                    }}
                    className="input"
                    placeholder="CF283A, 725, TN-1075… — или оставьте пустым"
                  />
                  {hints.length > 0 && (
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                      <span className="text-muted-fg">Подходят к этому принтеру:</span>
                      {hints.map((h) => (
                        <button
                          type="button"
                          key={`${h.brand}-${h.model}`}
                          onClick={() => {
                            userTouchedCartridge.current = true;
                            setCartridge(`${h.brand} ${h.model}`);
                          }}
                          className="rounded-full border border-border bg-bg-2 px-2.5 py-1 font-medium hover:border-primary hover:text-primary"
                        >
                          {h.brand} {h.model}{h.hasChip ? " · чип" : ""}
                        </button>
                      ))}
                    </div>
                  )}
                  {hintsLoading && printer.trim().length >= 2 && hints.length === 0 && (
                    <div className="mt-2 text-xs text-muted-fg">ищем подходящие картриджи…</div>
                  )}
                </Field>
              )}
              <Field label="Комментарий">
                <textarea
                  name="comment"
                  value={comment}
                  onChange={(e) => {
                    userTouchedComment.current = true;
                    setComment(e.target.value);
                  }}
                  className="input min-h-[88px]"
                  placeholder="Что случилось, удобное время и т.п."
                />
              </Field>
              {state.error && <div className="text-sm text-danger">{state.error}</div>}
              <button type="submit" disabled={pending} className="btn-primary btn-glow w-full text-base py-3.5">
                {pending ? "Отправка…" : <>Отправить заявку <ArrowRight className="h-4 w-4" /></>}
              </button>
              <p className="text-xs text-muted-fg">Нажимая кнопку, вы соглашаетесь с обработкой персональных данных.</p>
            </form>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-xs font-medium text-muted-fg mb-2 uppercase tracking-wider">{label}</div>
      {children}
    </label>
  );
}
