"use client";
import { useActionState, useEffect, useState } from "react";
import { submitLead, type LeadFormState, getUpcomingHolidays } from "@/app/actions";
import { Send, CheckCircle2, ArrowRight, CalendarOff } from "lucide-react";
import { Reveal } from "./Reveal";
import { format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import { AutocompleteInput } from "./crm/AutocompleteInput";

const services = [
  { value: "REFILL", label: "Заправка" },
  { value: "REPLACE", label: "Замена" },
  { value: "DIAGNOSTIC", label: "Диагностика" },
  { value: "REPAIR", label: "Ремонт" },
];

type CartridgeHint = { brand: string; model: string; hasChip: boolean };

export function RequestForm() {
  const [state, formAction, pending] = useActionState<LeadFormState, FormData>(submitLead, {});
  const [holidays, setHolidays] = useState<{ date: string; reason: string }[]>([]);
  const [address, setAddress] = useState("Санкт-Петербург, ");
  const [printer, setPrinter] = useState("");
  const [cartridge, setCartridge] = useState("");
  const [hints, setHints] = useState<CartridgeHint[]>([]);
  const [hintsLoading, setHintsLoading] = useState(false);

  // Подтягиваем подходящие картриджи, когда клиент выбрал/ввёл принтер.
  // Это работает и если он не выбирал из выпадашки — лишь бы написал что-то распознаваемое.
  useEffect(() => {
    const q = printer.trim();
    if (q.length < 2) { setHints([]); return; }
    const controller = new AbortController();
    const t = setTimeout(async () => {
      setHintsLoading(true);
      try {
        const res = await fetch(`/api/public/cartridges-for-printer?q=${encodeURIComponent(q)}`, { signal: controller.signal });
        const data = await res.json();
        setHints(data.cartridges || []);
      } catch (e: any) {
        if (e?.name !== "AbortError") setHints([]);
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
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Услуга">
                  <select name="serviceKind" className="input">{services.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select>
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
              <Field label="Картридж (если знаете)">
                <input
                  name="cartridge"
                  value={cartridge}
                  onChange={(e) => setCartridge(e.target.value)}
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
                        onClick={() => setCartridge(`${h.brand} ${h.model}`)}
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
              <Field label="Комментарий">
                <textarea name="comment" className="input min-h-[88px]" placeholder="Что случилось, удобное время и т.п." />
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
