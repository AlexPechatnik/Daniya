"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X, Calendar as CalIcon, AlertTriangle } from "lucide-react";
import { addDays, format, nextSaturday, nextSunday, parseISO } from "date-fns";
import { ru } from "date-fns/locale";

interface HolidayItem { id: string; date: string; reason: string }

export function HolidaysEditor({ initialHolidays }: { initialHolidays: HolidayItem[] }) {
  const router = useRouter();
  const [items, setItems] = useState<HolidayItem[]>(initialHolidays);
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("Выходной");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const today = new Date();
  const quickDates = [
    { label: "Сегодня", sub: format(today, "d MMM", { locale: ru }), value: toDateInputValue(today) },
    { label: "Завтра", sub: format(addDays(today, 1), "d MMM", { locale: ru }), value: toDateInputValue(addDays(today, 1)) },
    { label: "Суббота", sub: format(nextSaturday(today), "d MMM", { locale: ru }), value: toDateInputValue(nextSaturday(today)) },
    { label: "Воскресенье", sub: format(nextSunday(today), "d MMM", { locale: ru }), value: toDateInputValue(nextSunday(today)) },
  ];

  async function add() {
    if (!date) return;
    setPending(true); setError("");
    const res = await fetch("/api/holidays", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ date, reason }),
    });
    setPending(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error || "Ошибка");
      return;
    }
    const data = await res.json();
    setItems((arr) => [...arr, { id: data.holiday.id, date: data.holiday.date, reason: data.holiday.reason || "Выходной" }].sort((a, b) => a.date.localeCompare(b.date)));
    setDate("");
    router.refresh();
  }

  async function remove(id: string) {
    await fetch(`/api/holidays?id=${id}`, { method: "DELETE" });
    setItems((arr) => arr.filter((x) => x.id !== id));
    router.refresh();
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr,1fr]">
      <div className="card p-5">
        <div className="font-semibold mb-4 flex items-center gap-2">
          <Plus className="h-4 w-4 text-primary" />
          Добавить нерабочий день
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-fg uppercase tracking-wider mb-1.5 block">Дата</label>
            <div className="rounded-2xl border border-border bg-bg/40 p-3 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-medium flex items-center gap-2">
                    <CalIcon className="h-4 w-4 text-primary" />
                    {date ? format(parseLocalDate(date), "d MMMM yyyy, EEEE", { locale: ru }) : "Дата не выбрана"}
                  </div>
                  <div className="text-xs text-muted-fg mt-0.5">
                    {date ? "Этот день будет помечен как нерабочий" : "Выберите день одним нажатием"}
                  </div>
                </div>
                {date && (
                  <button type="button" onClick={() => setDate("")} className="btn-ghost p-2 shrink-0" title="Очистить">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {quickDates.map((option) => (
                  <button
                    key={option.label}
                    type="button"
                    onClick={() => setDate(option.value)}
                    className={`rounded-xl border px-3 py-3 text-left transition ${
                      date === option.value ? "border-primary bg-primary/10 text-fg" : "border-border bg-card/40 hover:bg-card"
                    }`}
                  >
                    <div className="text-sm font-medium leading-tight">{option.label}</div>
                    <div className="text-xs text-muted-fg mt-1">{option.sub}</div>
                  </button>
                ))}
              </div>
              <input type="date" className="input h-12 text-base" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-fg uppercase tracking-wider mb-1.5 block">Причина</label>
            <select className="input" value={reason} onChange={(e) => setReason(e.target.value)}>
              <option value="Выходной">Выходной</option>
              <option value="Праздник">Праздник</option>
              <option value="Отпуск">Отпуск</option>
              <option value="Болезнь">Болезнь</option>
              <option value="Другое">Другое</option>
            </select>
          </div>
          {error && <div className="text-sm text-danger flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> {error}</div>}
          <button onClick={add} disabled={!date || pending} className="btn-primary w-full">
            {pending ? "Добавление…" : "Добавить день"}
          </button>
        </div>
      </div>

      <div className="card p-5">
        <div className="font-semibold mb-4 flex items-center gap-2">
          <CalIcon className="h-4 w-4 text-primary" />
          Отмеченные дни ({items.length})
        </div>
        {items.length === 0 ? (
          <div className="text-sm text-muted-fg text-center py-8">Нерабочих дней не отмечено</div>
        ) : (
          <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
            <AnimatePresence>
              {items.map((h) => (
                <motion.div
                  key={h.id}
                  layout
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border bg-bg/40 px-3 py-2"
                >
                  <div className="text-sm">
                    <div className="font-medium">{format(parseISO(h.date), "d MMMM yyyy, EEEE", { locale: ru })}</div>
                    <div className="text-xs text-muted-fg">{h.reason}</div>
                  </div>
                  <button onClick={() => remove(h.id)} className="btn-ghost p-1.5" title="Убрать">
                    <X className="h-4 w-4" />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}

function toDateInputValue(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseLocalDate(value: string) {
  return new Date(`${value}T00:00:00`);
}
