"use client";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { format, parseISO, getDay, startOfWeek, addDays, isSameDay } from "date-fns";
import { ru } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatRub } from "@/lib/utils";

interface DayCell {
  date: string;
  key: string;
  count: number;
  revenue: number;
}

interface DayDetails {
  [key: string]: { count: number; revenue: number; items: { id: string; number: number; client: string; service?: string; price?: number | null; paid: boolean }[] };
}

export function HistoryHeatmap({
  year, days, details, total, totalRevenue, activeDays,
}: {
  year: number;
  days: DayCell[];
  details: DayDetails;
  total: number;
  totalRevenue: number;
  activeDays: number;
}) {
  const router = useRouter();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const max = Math.max(1, ...days.map((d) => d.count));
  const currentYear = new Date().getFullYear();

  // Раскладываем по неделям. Колонки — недели, строки — дни (Пн-Вс)
  const grid = useMemo(() => {
    const first = parseISO(days[0].date);
    // Понедельник той недели, в которой 1 января
    const weekStart = startOfWeek(first, { weekStartsOn: 1 });
    const weeks: (DayCell | null)[][] = [];
    let cursor = weekStart;
    const lastDate = parseISO(days[days.length - 1].date);
    while (cursor <= lastDate) {
      const week: (DayCell | null)[] = [];
      for (let i = 0; i < 7; i++) {
        const day = addDays(cursor, i);
        if (day.getFullYear() === year) {
          const found = days.find((d) => isSameDay(parseISO(d.date), day));
          week.push(found || null);
        } else {
          week.push(null);
        }
      }
      weeks.push(week);
      cursor = addDays(cursor, 7);
    }
    return weeks;
  }, [days, year]);

  const monthLabels = useMemo(() => {
    const labels: { weekIndex: number; label: string }[] = [];
    let lastMonth = -1;
    grid.forEach((week, wi) => {
      const firstDay = week.find((d) => d);
      if (firstDay) {
        const m = parseISO(firstDay.date).getMonth();
        if (m !== lastMonth) {
          labels.push({ weekIndex: wi, label: format(parseISO(firstDay.date), "LLL", { locale: ru }) });
          lastMonth = m;
        }
      }
    });
    return labels;
  }, [grid]);

  const selected = selectedKey ? details[selectedKey] : null;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">История выполненных</h1>
          <p className="text-sm text-muted-fg mt-1">Карта-тепло выполненных заявок за год.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => router.push(`/crm/history?year=${year - 1}`)} className="btn-ghost p-2">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="font-mono text-sm tabular-nums px-2">{year}</div>
          <button
            onClick={() => year < currentYear && router.push(`/crm/history?year=${year + 1}`)}
            disabled={year >= currentYear}
            className="btn-ghost p-2 disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* KPI */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card p-5">
          <div className="text-xs uppercase tracking-wider text-muted-fg">Выполнено заявок</div>
          <div className="mt-2 text-3xl font-semibold tabular-nums">{total}</div>
        </div>
        <div className="card p-5">
          <div className="text-xs uppercase tracking-wider text-muted-fg">Выручка</div>
          <div className="mt-2 text-3xl font-semibold tabular-nums text-primary">{formatRub(totalRevenue)}</div>
        </div>
        <div className="card p-5">
          <div className="text-xs uppercase tracking-wider text-muted-fg">Рабочих дней</div>
          <div className="mt-2 text-3xl font-semibold tabular-nums">{activeDays}</div>
          <div className="text-xs text-muted-fg mt-1">с хотя бы одной выполненной заявкой</div>
        </div>
      </div>

      {/* Heatmap */}
      <div className="card p-5 lg:p-6 overflow-x-auto">
        <div className="min-w-fit">
          {/* Месяцы */}
          <div className="flex items-center pl-7 mb-2">
            {grid.map((_, wi) => {
              const label = monthLabels.find((l) => l.weekIndex === wi);
              return (
                <div key={wi} className="w-3.5 mr-0.5 text-[10px] text-muted-fg font-mono uppercase">
                  {label?.label || ""}
                </div>
              );
            })}
          </div>
          <div className="flex">
            {/* Дни недели */}
            <div className="flex flex-col mr-1 text-[10px] text-muted-fg font-mono pt-0.5">
              {["Пн", "", "Ср", "", "Пт", "", "Вс"].map((d, i) => (
                <div key={i} className="h-3.5 mb-0.5 leading-3">{d}</div>
              ))}
            </div>
            {/* Клетки */}
            <div className="flex gap-0.5">
              {grid.map((week, wi) => (
                <div key={wi} className="flex flex-col gap-0.5">
                  {week.map((day, di) => {
                    if (!day) return <div key={di} className="h-3.5 w-3.5" />;
                    const level = day.count === 0 ? 0 : Math.min(4, Math.ceil((day.count / max) * 4));
                    const bgClasses = [
                      "bg-muted/30",
                      "bg-primary/20",
                      "bg-primary/40",
                      "bg-primary/70",
                      "bg-primary",
                    ];
                    const isSelected = selectedKey === day.key;
                    return (
                      <motion.button
                        key={di}
                        onClick={() => setSelectedKey(day.count > 0 ? (isSelected ? null : day.key) : null)}
                        title={`${format(parseISO(day.date), "d MMMM yyyy", { locale: ru })} — ${day.count} зак.`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: wi * 0.005 }}
                        className={`h-3.5 w-3.5 rounded-sm ${bgClasses[level]} hover:ring-2 hover:ring-primary/50 transition ${isSelected ? "ring-2 ring-primary" : ""} ${day.count > 0 ? "cursor-pointer" : "cursor-default"}`}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
          {/* Легенда */}
          <div className="mt-5 flex items-center gap-2 text-xs text-muted-fg">
            <span>меньше</span>
            <div className="h-3 w-3 rounded-sm bg-muted/30" />
            <div className="h-3 w-3 rounded-sm bg-primary/20" />
            <div className="h-3 w-3 rounded-sm bg-primary/40" />
            <div className="h-3 w-3 rounded-sm bg-primary/70" />
            <div className="h-3 w-3 rounded-sm bg-primary" />
            <span>больше</span>
          </div>
        </div>
      </div>

      {/* Детали выбранного дня */}
      {selected && selectedKey && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-5 lg:p-6"
        >
          <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-fg">Заявки за день</div>
              <div className="mt-1 font-semibold">{format(parseISO(selectedKey), "d MMMM yyyy, EEEE", { locale: ru })}</div>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span className="text-muted-fg">Заявок: <span className="text-fg font-medium tabular-nums">{selected.count}</span></span>
              <span className="text-muted-fg">Выручка: <span className="text-primary font-medium tabular-nums">{formatRub(selected.revenue)}</span></span>
            </div>
          </div>
          <div className="divide-y divide-border">
            {selected.items.map((i) => (
              <Link key={i.id} href={`/crm/requests/${i.id}`} className="block py-2.5 flex items-center justify-between gap-3 hover:bg-muted/20 px-2 -mx-2 rounded">
                <div className="text-sm">
                  <span className="font-mono text-xs text-muted-fg mr-3">#{i.number}</span>
                  <span className="font-medium">{i.client}</span>
                  {i.service && <span className="text-muted-fg ml-2">· {i.service}</span>}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="tabular-nums">{formatRub(i.price)}</span>
                  <span className={`text-xs ${i.paid ? "font-semibold text-[#166534]" : "text-muted-fg"}`}>{i.paid ? "оплачено" : "не оплачено"}</span>
                </div>
              </Link>
            ))}
            {selected.items.length < selected.count && (
              <div className="py-2 text-xs text-muted-fg text-center">…и ещё {selected.count - selected.items.length}</div>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}
