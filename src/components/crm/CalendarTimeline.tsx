"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import {
  Calendar as CalendarIcon,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  GripVertical,
  ListChecks,
  MapPin,
  Navigation,
  Phone,
  Plus,
  Route,
  UserRound,
} from "lucide-react";
import {
  addDays,
  format,
  getDaysInMonth,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ru } from "date-fns/locale";
import { districtMeta } from "@/lib/districts";
import { StatusBadge } from "./StatusBadge";
import { EmptyState } from "./EmptyState";

type View = "day" | "week" | "month";

interface ReqLite {
  id: string;
  number: number;
  clientName: string;
  serviceName: string;
  address: string;
  district?: string | null;
  lat?: number | null;
  lng?: number | null;
  phone: string;
  scheduledAt: string;
  duration: number;
  status: string;
  masterId: string | null;
  masterName?: string | null;
}
type QueueReqLite = Omit<ReqLite, "scheduledAt">;
interface HolidayLite { date: string; reason: string }
interface FreeSlotsLite { date: string; slots: string[] }

export function CalendarTimeline({
  days,
  requests,
  unscheduled = [],
  holidays = [],
  freeSlots = [],
  anchor,
  view: initialView = "day",
}: {
  days: string[];
  requests: ReqLite[];
  unscheduled?: QueueReqLite[];
  holidays?: HolidayLite[];
  freeSlots?: FreeSlotsLite[];
  anchor: string;
  view?: View;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const view = ((sp.get("view") as View) || initialView);
  const anchorDate = parseLocalDay(anchor);
  const activeDayKey = toDateKey(anchorDate);
  const todayKey = toDateKey(new Date());

  // Группируем заявки по дням — один проход, дальше O(1) лукапы по дню.
  const requestsByDay = useMemo(() => {
    const m = new Map<string, ReqLite[]>();
    for (const r of requests) {
      const key = r.scheduledAt.slice(0, 10);
      const arr = m.get(key) || [];
      arr.push(r);
      m.set(key, arr);
    }
    for (const arr of m.values()) arr.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
    return m;
  }, [requests]);

  function navigate(delta: number) {
    let next: Date;
    if (view === "month") {
      const d = new Date(anchorDate);
      d.setMonth(d.getMonth() + delta);
      next = d;
    } else if (view === "week") {
      next = addDays(anchorDate, delta * 7);
    } else {
      next = addDays(anchorDate, delta);
    }
    router.push(`/crm/calendar?from=${toDateKey(next)}&view=${view}`);
  }

  function goToDay(dayKey: string, switchToDay = true) {
    router.push(`/crm/calendar?from=${dayKey}&view=${switchToDay ? "day" : view}`);
  }

  function switchView(nextView: View) {
    router.push(`/crm/calendar?from=${activeDayKey}&view=${nextView}`);
  }

  // Перетащили unscheduled-заявку → ставим её на этот день в 10:00 по умолчанию.
  async function scheduleOnDay(requestId: string, dayKey: string) {
    const scheduledAt = `${dayKey}T10:00:00`;
    try {
      const res = await fetch("/api/requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: requestId, scheduledAt, status: "SCHEDULED" }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      router.refresh();
    } catch (e) {
      console.error("scheduleOnDay failed", e);
      alert("Не удалось поставить заявку. Попробуйте ещё раз.");
    }
  }

  return (
    <div className="space-y-4">
      <Header
        view={view}
        anchorDate={anchorDate}
        activeDayKey={activeDayKey}
        todayKey={todayKey}
        days={days}
        onPrev={() => navigate(-1)}
        onNext={() => navigate(1)}
        onToday={() => router.push("/crm/calendar")}
        onView={switchView}
      />

      {/* Полоса 7 дней показывается только в режиме «день» — она тут даёт
          контекст недели. В week/month эту функцию выполняет сама сетка. */}
      {view === "day" && (
        <DayStrip
          weekStart={startOfWeek(anchorDate, { weekStartsOn: 1 })}
          requestsByDay={requestsByDay}
          holidays={holidays}
          activeDayKey={activeDayKey}
          todayKey={todayKey}
          onPick={(d) => goToDay(d, true)}
        />
      )}

      {view === "day" && (
        <DayPlanner
          dayKey={activeDayKey}
          requests={requestsByDay.get(activeDayKey) || []}
          queue={unscheduled}
          slots={freeSlots.find((f) => f.date === activeDayKey)?.slots || []}
          holiday={holidays.find((h) => h.date === activeDayKey)}
        />
      )}

      {view === "week" && (
        <WeekPlanner
          weekStart={startOfWeek(anchorDate, { weekStartsOn: 1 })}
          requestsByDay={requestsByDay}
          holidays={holidays}
          queue={unscheduled}
          todayKey={todayKey}
          onPickDay={(d) => goToDay(d, true)}
          onSchedule={scheduleOnDay}
        />
      )}

      {view === "month" && (
        <MonthPlanner
          anchorDate={anchorDate}
          requestsByDay={requestsByDay}
          holidays={holidays}
          queue={unscheduled}
          todayKey={todayKey}
          onPickDay={(d) => goToDay(d, true)}
          onSchedule={scheduleOnDay}
        />
      )}
    </div>
  );
}

// ─── HEADER ─────────────────────────────────────────────────────────────

function Header({
  view, anchorDate, activeDayKey, todayKey, days,
  onPrev, onNext, onToday, onView,
}: {
  view: View;
  anchorDate: Date;
  activeDayKey: string;
  todayKey: string;
  days: string[];
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onView: (v: View) => void;
}) {
  // Заголовок периода
  let title: string;
  if (view === "day") {
    title = format(anchorDate, "d MMMM, EEEE", { locale: ru });
  } else if (view === "week") {
    const start = startOfWeek(anchorDate, { weekStartsOn: 1 });
    title = `${format(start, "d MMM", { locale: ru })} – ${format(addDays(start, 6), "d MMMM", { locale: ru })}`;
  } else {
    title = format(anchorDate, "LLLL yyyy", { locale: ru });
  }

  const isOnToday = activeDayKey === todayKey;

  return (
    <section className="rounded-2xl border border-border bg-card/45 p-3 md:p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <button onClick={onPrev} className="btn-ghost p-2" aria-label="Назад">
            <ChevronLeft className="h-4 w-4" />
          </button>
          {/* Кнопка «Сегодня» — только когда мы не на сегодня. Иначе занимает место без действия. */}
          {!isOnToday && (
            <button onClick={onToday} className="btn-outline h-9 gap-2 px-3 text-sm">
              <CalendarIcon className="h-4 w-4" /> Сегодня
            </button>
          )}
          <button onClick={onNext} className="btn-ghost p-2" aria-label="Вперёд">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* iOS-segmented control: soft-tint вместо filled-primary, чтобы не «кричал». */}
        <div className="inline-flex rounded-xl border border-border bg-bg-2/60 p-0.5 text-sm">
          {(["day", "week", "month"] as View[]).map((v) => {
            const active = view === v;
            return (
              <button
                key={v}
                onClick={() => onView(v)}
                className={`h-9 rounded-lg px-3.5 transition ${
                  active
                    ? "bg-card text-fg shadow-sm"
                    : "text-muted-fg hover:text-fg"
                }`}
              >
                {v === "day" ? "День" : v === "week" ? "Неделя" : "Месяц"}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-fg">
            {view === "day" ? "Поездки за день" : view === "week" ? "Поездки на неделю" : "Месячный обзор"}
            {view === "day" && <DayRelationBadge dayKey={activeDayKey} todayKey={todayKey} />}
          </div>
          <div className="mt-1 text-2xl font-semibold tracking-tight capitalize">{title}</div>
        </div>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent("printcare:quickadd"))}
          className="btn-primary h-11 px-4"
        >
          <Plus className="h-4 w-4" /> Новая заявка
        </button>
      </div>
    </section>
  );
}

// ─── DAY STRIP (контекст недели в режиме «день») ────────────────────────

function DayStrip({
  weekStart, requestsByDay, holidays, activeDayKey, todayKey, onPick,
}: {
  weekStart: Date;
  requestsByDay: Map<string, ReqLite[]>;
  holidays: HolidayLite[];
  activeDayKey: string;
  todayKey: string;
  onPick: (dayKey: string) => void;
}) {
  return (
    <div className="overflow-x-auto pb-1">
      <div className="grid min-w-[720px] grid-cols-7 gap-2">
        {Array.from({ length: 7 }).map((_, i) => {
          const day = addDays(weekStart, i);
          const dayKey = toDateKey(day);
          const count = requestsByDay.get(dayKey)?.length || 0;
          const holiday = holidays.find((h) => h.date === dayKey);
          const active = dayKey === activeDayKey;
          const isToday = dayKey === todayKey;
          const isPast = dayKey < todayKey;

          return (
            <button
              key={dayKey}
              type="button"
              onClick={() => onPick(dayKey)}
              className={`relative min-h-[90px] rounded-2xl border p-3 text-left transition ${
                active
                  ? "border-primary/60 bg-primary/10"
                  : isToday
                    ? "border-primary/30 bg-primary/[0.05]"
                    : holiday
                      ? "border-warning/30 bg-warning/[0.05]"
                      : isPast
                        ? "border-border bg-bg-2/40 text-muted-fg"
                        : "border-border bg-card hover:bg-muted/40"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className={`text-[11px] lowercase ${active || isToday ? "text-primary" : "text-muted-fg"}`}>
                    {format(day, "EEEEEE", { locale: ru })}
                  </div>
                  <div className={`mt-1 text-2xl font-semibold tabular-nums ${active || isToday ? "text-primary" : ""}`}>
                    {format(day, "d")}
                  </div>
                </div>
                {count > 0 && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] tabular-nums text-muted-fg">
                    {count}
                  </span>
                )}
              </div>
              <div className="mt-2 text-[11px] text-muted-fg">
                {count > 0 ? daySummary(count) : holiday ? holiday.reason : "свободно"}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── DAY PLANNER ────────────────────────────────────────────────────────

function DayPlanner({
  dayKey, requests, queue, slots, holiday,
}: {
  dayKey: string;
  requests: ReqLite[];
  queue: QueueReqLite[];
  slots: string[];
  holiday?: HolidayLite;
}) {
  const districts = districtCounts(requests);

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr),360px]">
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <SummaryTile icon={Route} label="В плане" value={String(requests.length)} hint={daySummary(requests.length)} />
          <SummaryTile icon={MapPin} label="Районы" value={String(districts.length)} hint={districts[0]?.[0] || "нет адресов"} />
          <SummaryTile icon={Clock} label="Окна" value={String(slots.length)} hint={holiday ? holiday.reason : "свободное время"} />
        </div>

        {holiday && (
          <div className="rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
            Нерабочий день: {holiday.reason}. Заявку можно создать, но клиенту нужно подтвердить выезд отдельно.
          </div>
        )}

        <section className="overflow-hidden rounded-2xl border border-border bg-card/45">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
            <h2 className="font-semibold">Поездки</h2>
            <DistrictChips districts={districts} />
          </div>
          {requests.length > 0 ? (
            <div className="divide-y divide-border">
              {requests.map((request, index) => (
                <TripCard key={request.id} request={request} index={index + 1} />
              ))}
            </div>
          ) : (
            <EmptyPlan />
          )}
        </section>
      </div>

      {/* Сайдбар: сначала Очередь (важно), затем Окна (вспомогательно). */}
      <aside className="space-y-4">
        <section className="overflow-hidden rounded-2xl border border-border bg-card/45">
          <div className="border-b border-border px-4 py-3">
            <h2 className="font-semibold">Очередь без времени</h2>
            <div className="mt-0.5 text-sm text-muted-fg">
              Перетащите на день в режиме «Неделя» или «Месяц», чтобы поставить в план.
            </div>
          </div>
          {queue.length > 0 ? (
            <div className="divide-y divide-border">
              {queue.slice(0, 8).map((request) => <QueueCard key={request.id} request={request} draggable={false} />)}
              {queue.length > 8 && (
                <div className="px-4 py-2 text-xs text-muted-fg">…ещё {queue.length - 8}</div>
              )}
            </div>
          ) : (
            <EmptyState icon={ListChecks} tone="green" compact title="Очередь пустая" hint="Все заявки уже распределены по дням." />
          )}
        </section>

        <section className="overflow-hidden rounded-2xl border border-border bg-card/45">
          <div className="border-b border-border px-4 py-3">
            <h2 className="font-semibold">Свободные окна</h2>
            <div className="mt-0.5 text-sm text-muted-fg">Ближайшие варианты выезда.</div>
          </div>
          {slots.length > 0 ? (
            <div className="grid grid-cols-2 gap-2 p-3">
              {slots.slice(0, 4).map((slot) => (
                <button
                  key={slot}
                  type="button"
                  onClick={() => window.dispatchEvent(new CustomEvent("printcare:quickadd", { detail: { scheduledAt: slot } }))}
                  className="rounded-xl border border-border bg-card px-3 py-3 text-left transition hover:border-primary hover:bg-primary/5"
                >
                  <div className="font-mono text-base font-semibold text-primary">{format(parseISO(slot), "HH:mm")}</div>
                  <div className="mt-1 text-xs text-muted-fg">создать заявку</div>
                </button>
              ))}
            </div>
          ) : (
            <div className="p-4 text-sm text-muted-fg">{holiday ? "День отмечен нерабочим." : "Свободных окон нет."}</div>
          )}
        </section>
      </aside>
    </div>
  );
}

// ─── WEEK PLANNER (drag&drop) ───────────────────────────────────────────

function WeekPlanner({
  weekStart, requestsByDay, holidays, queue, todayKey, onPickDay, onSchedule,
}: {
  weekStart: Date;
  requestsByDay: Map<string, ReqLite[]>;
  holidays: HolidayLite[];
  queue: QueueReqLite[];
  todayKey: string;
  onPickDay: (dayKey: string) => void;
  onSchedule: (requestId: string, dayKey: string) => void;
}) {
  const days = Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i));
  const counts = days.map((d) => requestsByDay.get(toDateKey(d))?.length || 0);
  const maxCount = Math.max(1, ...counts);

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr),300px]">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-7">
        {days.map((day, idx) => {
          const dayKey = toDateKey(day);
          const dayRequests = requestsByDay.get(dayKey) || [];
          const holiday = holidays.find((h) => h.date === dayKey);
          const isToday = dayKey === todayKey;
          const load = counts[idx] / maxCount; // 0..1 для подсветки нагрузки
          return (
            <DropZoneDay
              key={dayKey}
              day={day}
              dayKey={dayKey}
              requests={dayRequests}
              holiday={holiday}
              isToday={isToday}
              load={load}
              onClickHeader={() => onPickDay(dayKey)}
              onSchedule={onSchedule}
            />
          );
        })}
      </div>
      <aside className="space-y-3">
        <QueuePanel queue={queue} />
      </aside>
    </div>
  );
}

function DropZoneDay({
  day, dayKey, requests, holiday, isToday, load,
  onClickHeader, onSchedule,
}: {
  day: Date;
  dayKey: string;
  requests: ReqLite[];
  holiday?: HolidayLite;
  isToday: boolean;
  load: number;
  onClickHeader: () => void;
  onSchedule: (requestId: string, dayKey: string) => void;
}) {
  const [hover, setHover] = useState(false);

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setHover(false);
    const id = e.dataTransfer.getData("text/plain");
    if (id) onSchedule(id, dayKey);
  }

  return (
    <section
      onDragOver={(e) => { e.preventDefault(); setHover(true); }}
      onDragLeave={() => setHover(false)}
      onDrop={onDrop}
      className={`relative rounded-2xl border p-3 transition ${
        hover
          ? "border-primary bg-primary/10"
          : holiday
            ? "border-warning/30 bg-warning/[0.05]"
            : isToday
              ? "border-primary/30 bg-primary/[0.05]"
              : "border-border bg-card"
      }`}
    >
      <button
        type="button"
        onClick={onClickHeader}
        className="flex w-full items-start justify-between gap-2 text-left"
      >
        <div>
          <div className="text-[11px] lowercase text-muted-fg">{format(day, "EEEEEE", { locale: ru })}</div>
          <div className={`text-lg font-semibold ${isToday ? "text-primary" : ""}`}>
            {format(day, "d MMM", { locale: ru })}
          </div>
        </div>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-fg">{requests.length}</span>
      </button>

      {/* Тепло-полоска нагрузки */}
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-primary/70" style={{ width: `${Math.max(8, load * 100)}%` }} />
      </div>

      {holiday && <div className="mt-2 text-xs font-medium text-warning">{holiday.reason}</div>}

      <div className="mt-3 space-y-2">
        {requests.slice(0, 4).map((r) => (
          <Link
            key={r.id}
            href={`/crm/requests/${r.id}`}
            className="block rounded-xl border border-border bg-bg/40 px-2.5 py-2 transition hover:bg-muted/40"
          >
            <div className="font-mono text-xs text-primary">{format(parseISO(r.scheduledAt), "HH:mm")}</div>
            <div className="mt-0.5 truncate text-sm font-medium">#{r.number} · {r.clientName}</div>
            <div className="truncate text-xs text-muted-fg">{r.district || r.serviceName}</div>
          </Link>
        ))}
        {requests.length > 4 && <div className="text-xs text-muted-fg">ещё {requests.length - 4}</div>}
        {requests.length === 0 && (
          <div className="rounded-xl border border-dashed border-border px-2 py-5 text-center text-[11px] text-muted-fg">
            свободно — перетащите сюда
          </div>
        )}
      </div>
    </section>
  );
}

// ─── MONTH PLANNER ──────────────────────────────────────────────────────

function MonthPlanner({
  anchorDate, requestsByDay, holidays, queue, todayKey, onPickDay, onSchedule,
}: {
  anchorDate: Date;
  requestsByDay: Map<string, ReqLite[]>;
  holidays: HolidayLite[];
  queue: QueueReqLite[];
  todayKey: string;
  onPickDay: (dayKey: string) => void;
  onSchedule: (requestId: string, dayKey: string) => void;
}) {
  const monthStart = startOfMonth(anchorDate);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  // 42 = 6 недель × 7 дней — стандартная месячная сетка
  const cells = Array.from({ length: 42 }).map((_, i) => addDays(gridStart, i));

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr),300px]">
      <div>
        <div className="grid grid-cols-7 gap-2 text-center text-[11px] uppercase tracking-wider text-muted-fg">
          {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((d) => <div key={d}>{d}</div>)}
        </div>
        <div className="mt-2 grid grid-cols-7 gap-2">
          {cells.map((day) => {
            const dayKey = toDateKey(day);
            const inMonth = isSameMonth(day, anchorDate);
            const dayRequests = requestsByDay.get(dayKey) || [];
            const holiday = holidays.find((h) => h.date === dayKey);
            const isToday = dayKey === todayKey;
            return (
              <MonthCell
                key={dayKey}
                day={day}
                dayKey={dayKey}
                inMonth={inMonth}
                requests={dayRequests}
                holiday={holiday}
                isToday={isToday}
                onClick={() => onPickDay(dayKey)}
                onSchedule={onSchedule}
              />
            );
          })}
        </div>
      </div>
      <aside className="space-y-3">
        <QueuePanel queue={queue} />
      </aside>
    </div>
  );
}

function MonthCell({
  day, dayKey, inMonth, requests, holiday, isToday,
  onClick, onSchedule,
}: {
  day: Date;
  dayKey: string;
  inMonth: boolean;
  requests: ReqLite[];
  holiday?: HolidayLite;
  isToday: boolean;
  onClick: () => void;
  onSchedule: (requestId: string, dayKey: string) => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onDragOver={(e) => { e.preventDefault(); setHover(true); }}
      onDragLeave={() => setHover(false)}
      onDrop={(e) => {
        e.preventDefault();
        setHover(false);
        const id = e.dataTransfer.getData("text/plain");
        if (id) onSchedule(id, dayKey);
      }}
      className={`relative flex min-h-[88px] flex-col rounded-xl border p-2 text-left transition ${
        hover
          ? "border-primary bg-primary/10"
          : holiday
            ? "border-warning/30 bg-warning/[0.05]"
            : isToday
              ? "border-primary/40 bg-primary/[0.05]"
              : inMonth
                ? "border-border bg-card hover:bg-muted/30"
                : "border-border/40 bg-bg-2/40 text-muted-fg/60"
      }`}
    >
      <div className="flex items-start justify-between gap-1">
        <span className={`text-sm font-semibold tabular-nums ${isToday ? "text-primary" : ""}`}>
          {format(day, "d")}
        </span>
        {requests.length > 0 && (
          <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-primary">
            {requests.length}
          </span>
        )}
      </div>
      {holiday && (
        <div className="mt-1 truncate text-[10px] font-medium text-warning" title={holiday.reason}>
          {holiday.reason}
        </div>
      )}
      <div className="mt-1 space-y-0.5">
        {requests.slice(0, 2).map((r) => (
          <div key={r.id} className="truncate rounded bg-muted/40 px-1 py-0.5 text-[10px] leading-tight">
            <span className="font-mono">{format(parseISO(r.scheduledAt), "HH:mm")}</span>{" "}
            <span className="text-muted-fg">{r.clientName}</span>
          </div>
        ))}
        {requests.length > 2 && (
          <div className="text-[10px] text-muted-fg">+ ещё {requests.length - 2}</div>
        )}
      </div>
    </button>
  );
}

// ─── QUEUE PANEL (drag source) ──────────────────────────────────────────

function QueuePanel({ queue }: { queue: QueueReqLite[] }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card/45">
      <div className="border-b border-border px-4 py-3">
        <h2 className="font-semibold">Очередь без времени</h2>
        <div className="mt-0.5 text-xs text-muted-fg">
          Перетащите карточку на день — заявка станет на 10:00.
        </div>
      </div>
      {queue.length > 0 ? (
        <div className="max-h-[640px] divide-y divide-border overflow-y-auto">
          {queue.map((r) => <QueueCard key={r.id} request={r} draggable />)}
        </div>
      ) : (
        <EmptyState icon={ListChecks} tone="green" compact title="Очередь пустая" hint="Все заявки уже распределены по дням." />
      )}
    </section>
  );
}

function QueueCard({ request, draggable }: { request: QueueReqLite; draggable: boolean }) {
  const district = request.district ? districtMeta(request.district) : null;
  return (
    <div
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", request.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      className={`group flex items-start gap-2 px-3 py-2.5 ${
        draggable ? "cursor-grab active:cursor-grabbing hover:bg-muted/30" : ""
      }`}
    >
      {draggable && (
        <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-muted-fg/50 transition group-hover:text-muted-fg" />
      )}
      <Link href={`/crm/requests/${request.id}`} className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-muted-fg">#{request.number}</span>
          <StatusBadge status={request.status} size="sm" />
          {district && (
            <span
              className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{ background: `${district.color}22`, color: district.color, border: `1px solid ${district.color}55` }}
            >
              {district.name}
            </span>
          )}
        </div>
        <div className="mt-1 truncate text-sm font-medium">{request.clientName}</div>
        <div className="mt-0.5 truncate text-xs text-muted-fg">{request.serviceName}</div>
        {request.address && <div className="mt-0.5 truncate text-xs text-muted-fg">{request.address}</div>}
      </Link>
    </div>
  );
}

// ─── TRIP CARD (collapsed by default) ───────────────────────────────────

function TripCard({ request, index }: { request: ReqLite; index: number }) {
  const [open, setOpen] = useState(false);
  const dt = parseISO(request.scheduledAt);
  const district = request.district ? districtMeta(request.district) : null;
  const routeHref = buildRouteHref(request);

  return (
    <div className="px-4 py-3">
      {/* Свёрнутый вид — самое нужное, ничего лишнего */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 text-left"
      >
        <div className="flex w-12 shrink-0 flex-col items-center">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
            {index}
          </div>
          <div className="mt-1 font-mono text-sm font-semibold tabular-nums text-fg">
            {format(dt, "HH:mm")}
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-base font-semibold">{request.clientName}</span>
            <StatusBadge status={request.status} size="sm" />
            {district && (
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                style={{ background: `${district.color}22`, color: district.color, border: `1px solid ${district.color}55` }}
              >
                {district.name}
              </span>
            )}
          </div>
          {request.address && (
            <div className="mt-0.5 truncate text-sm text-muted-fg">{request.address}</div>
          )}
        </div>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-fg transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="ml-15 mt-3 space-y-3 border-l border-border pl-4">
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-fg">
            <span className="font-mono">#{request.number}</span>
            <span>·</span>
            <span>{request.serviceName}</span>
            <span>·</span>
            <span>{request.duration} мин</span>
            {request.masterName && (
              <>
                <span>·</span>
                <span className="inline-flex items-center gap-1"><UserRound className="h-3.5 w-3.5" /> {request.masterName}</span>
              </>
            )}
          </div>

          {/* Действия: primary = «Открыть», остальные — ghost/outline */}
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/crm/requests/${request.id}`}
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-medium text-primary-fg shadow-sm transition hover:opacity-90"
            >
              Открыть карточку
            </Link>
            <a
              href={`tel:${request.phone}`}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-sm text-fg transition hover:bg-muted"
            >
              <Phone className="h-4 w-4" /> Позвонить
            </a>
            {routeHref && (
              <a
                href={routeHref}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-sm text-fg transition hover:bg-muted"
              >
                <Navigation className="h-4 w-4" /> Маршрут
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Прочие мелочи ──────────────────────────────────────────────────────

function SummaryTile({ icon: Icon, label, value, hint }: { icon: typeof Route; label: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-fg">
        <Icon className="h-4 w-4" /> {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
      <div className="mt-1 truncate text-xs text-muted-fg">{hint}</div>
    </div>
  );
}

function DistrictChips({ districts }: { districts: [string, number][] }) {
  if (districts.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {districts.slice(0, 4).map(([name, count]) => {
        const meta = districtMeta(name);
        if (!meta) return null;
        return (
          <span
            key={name}
            className="rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{ background: `${meta.color}22`, color: meta.color, border: `1px solid ${meta.color}55` }}
          >
            {name} · {count}
          </span>
        );
      })}
    </div>
  );
}

function EmptyPlan() {
  return (
    <EmptyState
      icon={ListChecks}
      tone="purple"
      title="На день пока ничего не поставлено"
      hint="Возьмите заявку из очереди или создайте новую в свободное окно."
    />
  );
}

function DayRelationBadge({ dayKey, todayKey }: { dayKey: string; todayKey: string }) {
  const label = dayRelationLabel(dayKey, todayKey);
  if (!label) return null;
  return (
    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
      {label}
    </span>
  );
}

// ─── helpers ────────────────────────────────────────────────────────────

function districtCounts(requests: ReqLite[]) {
  const counts = new Map<string, number>();
  for (const r of requests) {
    if (!r.district) continue;
    counts.set(r.district, (counts.get(r.district) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

function daySummary(count: number) {
  if (count === 0) return "заявок нет";
  if (count === 1) return "1 заявка";
  if (count > 1 && count < 5) return `${count} заявки`;
  return `${count} заявок`;
}

function dayRelationLabel(dayKey: string, todayKey: string) {
  if (dayKey === todayKey) return "сегодня";
  if (dayKey === toDateKey(addDays(parseLocalDay(todayKey), 1))) return "завтра";
  if (dayKey === toDateKey(addDays(parseLocalDay(todayKey), -1))) return "вчера";
  return "";
}

function toDateKey(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseLocalDay(dayKey: string) {
  return new Date(`${dayKey.slice(0, 10)}T00:00:00`);
}

function buildRouteHref(request: Pick<ReqLite, "address" | "lat" | "lng">) {
  if (request.lat != null && request.lng != null) {
    return `https://yandex.ru/maps/?rtext=~${request.lat},${request.lng}&rtt=auto`;
  }
  if (request.address) return `https://yandex.ru/maps/?text=${encodeURIComponent(request.address)}`;
  return "";
}
