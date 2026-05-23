"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  ListChecks,
  MapPin,
  Navigation,
  Phone,
  Plus,
  Route,
  UserRound,
} from "lucide-react";
import { addDays, format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import { statusMeta } from "@/lib/status";
import { districtMeta } from "@/lib/districts";
import { StatusBadge } from "./StatusBadge";

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

interface QueueReqLite extends Omit<ReqLite, "scheduledAt"> {}
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
  view?: "day" | "week";
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const view = (sp.get("view") as "day" | "week") || initialView;
  const anchorDate = parseLocalDay(anchor);
  const activeDayKey = toDateKey(anchorDate);
  const todayKey = toDateKey(new Date());
  const weekDayKeys = days.map((d) => d.slice(0, 10));
  const visibleDayKeys = view === "day" ? [activeDayKey] : weekDayKeys;
  const visibleRequests = requests.filter((r) => visibleDayKeys.includes(r.scheduledAt.slice(0, 10)));
  const activeRequests = requests.filter((r) => r.scheduledAt.slice(0, 10) === activeDayKey);
  const activeHoliday = holidays.find((h) => h.date === activeDayKey);
  const activeSlots = freeSlots.find((f) => f.date === activeDayKey)?.slots || [];

  function navigate(delta: number) {
    const next = view === "day" ? addDays(anchorDate, delta) : addDays(anchorDate, delta * 7);
    router.push(`/crm/calendar?from=${toDateKey(next)}&view=${view}`);
  }

  function goToDay(dayKey: string) {
    router.push(`/crm/calendar?from=${dayKey}&view=day`);
  }

  function switchView(nextView: "day" | "week") {
    router.push(`/crm/calendar?from=${activeDayKey}&view=${nextView}`);
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-border bg-card/45 p-3 md:p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <button onClick={() => navigate(-1)} className="btn-ghost p-2" aria-label="Назад">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button onClick={() => router.push("/crm/calendar")} className="btn-outline h-10 gap-2 px-3">
              <CalendarIcon className="h-4 w-4" /> Сегодня
            </button>
            <button onClick={() => navigate(1)} className="btn-ghost p-2" aria-label="Вперёд">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="inline-flex rounded-xl border border-border bg-bg/45 p-0.5">
            <button onClick={() => switchView("day")} className={`h-8 rounded-lg px-3 text-xs transition ${view === "day" ? "bg-primary text-primary-fg" : "text-muted-fg hover:text-fg"}`}>День</button>
            <button onClick={() => switchView("week")} className={`h-8 rounded-lg px-3 text-xs transition ${view === "week" ? "bg-primary text-primary-fg" : "text-muted-fg hover:text-fg"}`}>Неделя</button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-xs uppercase tracking-wider text-muted-fg">{view === "day" ? "План выездов" : "Неделя"}</div>
              {view === "day" && <DayRelationBadge dayKey={activeDayKey} todayKey={todayKey} />}
            </div>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <div className="text-2xl font-semibold tracking-tight">
                {view === "day"
                  ? format(anchorDate, "d MMMM, EEEE", { locale: ru })
                  : `${format(parseLocalDay(weekDayKeys[0]), "d MMM", { locale: ru })} - ${format(parseLocalDay(weekDayKeys[6]), "d MMMM", { locale: ru })}`}
              </div>
              {view === "day" && activeDayKey !== todayKey && (
                <div className="text-sm text-muted-fg">{distanceFromToday(activeDayKey)}</div>
              )}
            </div>
          </div>
          <button type="button" onClick={() => openQuickAdd()} className="btn-primary h-11 px-4">
            <Plus className="h-4 w-4" /> Новая заявка
          </button>
        </div>

        <div className="mt-4 overflow-x-auto pb-1">
          <div className="grid min-w-[760px] grid-cols-7 gap-2">
          {weekDayKeys.map((dayKey, index) => {
            const day = parseLocalDay(dayKey);
            const count = requests.filter((r) => r.scheduledAt.slice(0, 10) === dayKey).length;
            const holiday = holidays.find((h) => h.date === dayKey);
            const active = dayKey === activeDayKey;
            const relation = dayRelation(dayKey, todayKey);
            return (
              <button
                key={dayKey}
                type="button"
                onClick={() => goToDay(dayKey)}
                className={`relative min-h-[106px] rounded-2xl border p-3 text-left transition ${
                  active
                    ? "border-primary bg-primary/15 shadow-[0_0_0_1px_hsl(var(--primary)/0.25)]"
                    : relation === "past"
                      ? "border-border/50 bg-bg/20 opacity-50 hover:opacity-75"
                      : relation === "today"
                        ? "border-primary/55 bg-primary/10"
                        : holiday
                          ? "border-amber-500/35 bg-amber-500/10"
                          : "border-border bg-bg/45 hover:bg-muted"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className={`text-[11px] uppercase tracking-wider ${active || relation === "today" ? "text-primary" : "text-muted-fg"}`}>
                      {format(day, "EEEEEE", { locale: ru })}
                    </div>
                    <div className={`mt-1 text-2xl font-semibold tabular-nums ${active || relation === "today" ? "text-primary" : ""}`}>{format(day, "d")}</div>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${dayRelationClass(relation, active)}`}>
                    {dayStripLabel(dayKey, todayKey, index)}
                  </span>
                </div>
                <div className="mt-3 text-xs text-muted-fg">
                  {count > 0 ? daySummary(count) : holiday ? holiday.reason : "нет выездов"}
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full ${count > 0 ? "bg-primary" : holiday ? "bg-amber-400" : "bg-muted-fg/25"}`}
                    style={{ width: count > 0 ? `${Math.min(100, 24 + count * 18)}%` : "16%" }}
                  />
                </div>
              </button>
            );
          })}
          </div>
        </div>
      </section>

      {view === "day" ? (
        <DayPlanner
          dayKey={activeDayKey}
          requests={activeRequests}
          queue={unscheduled}
          slots={activeSlots}
          holiday={activeHoliday}
        />
      ) : (
        <WeekPlanner
          days={days.map((d) => d.slice(0, 10))}
          requests={visibleRequests}
          holidays={holidays}
          queueCount={unscheduled.length}
        />
      )}
    </div>
  );
}

function DayPlanner({
  dayKey,
  requests,
  queue,
  slots,
  holiday,
}: {
  dayKey: string;
  requests: ReqLite[];
  queue: QueueReqLite[];
  slots: string[];
  holiday?: HolidayLite;
}) {
  const ordered = [...requests].sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  const districts = districtCounts(ordered);
  const topSlots = slots.slice(0, 4);

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr),360px]">
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <SummaryTile icon={Route} label="В плане" value={String(ordered.length)} hint={daySummary(ordered.length)} />
          <SummaryTile icon={MapPin} label="Районы" value={String(districts.length)} hint={districts[0]?.[0] || "нет адресов"} />
          <SummaryTile icon={Clock} label="Окна" value={String(slots.length)} hint={holiday ? holiday.reason : "свободное время"} />
        </div>

        {holiday && (
          <div className="rounded-2xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
            Нерабочий день: {holiday.reason}. Создать заявку можно, но клиенту нужно подтвердить выезд отдельно.
          </div>
        )}

        <section className="rounded-2xl border border-border bg-card/45 overflow-hidden">
          <div className="border-b border-border px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">План поездок</h2>
                <div className="mt-0.5 text-sm text-muted-fg">Список в порядке выезда. Без пустых часов и лишней сетки.</div>
              </div>
              <DistrictChips districts={districts} />
            </div>
          </div>

          {ordered.length > 0 ? (
            <div className="divide-y divide-border">
              {ordered.map((request, index) => <TripCard key={request.id} request={request} index={index + 1} />)}
            </div>
          ) : (
            <EmptyPlan />
          )}
        </section>
      </div>

      <aside className="space-y-4">
        <section className="rounded-2xl border border-border bg-card/45 overflow-hidden">
          <div className="border-b border-border px-4 py-3">
            <h2 className="font-semibold">Свободные окна</h2>
            <div className="mt-0.5 text-sm text-muted-fg">Показываем только ближайшие варианты, не всю сетку.</div>
          </div>
          {topSlots.length > 0 ? (
            <div className="grid grid-cols-2 gap-2 p-3">
              {topSlots.map((slot) => (
                <button
                  key={slot}
                  type="button"
                  onClick={() => openQuickAdd(slot)}
                  className="rounded-xl border border-border bg-bg/45 px-3 py-3 text-left transition hover:border-primary/50 hover:bg-primary/10"
                >
                  <div className="font-mono text-base font-semibold text-primary">{format(parseISO(slot), "HH:mm")}</div>
                  <div className="mt-1 text-xs text-muted-fg">создать заявку</div>
                </button>
              ))}
            </div>
          ) : (
            <div className="p-4 text-sm text-muted-fg">{holiday ? "День отмечен нерабочим." : "Свободных окон не найдено."}</div>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-card/45 overflow-hidden">
          <div className="border-b border-border px-4 py-3">
            <h2 className="font-semibold">Очередь без времени</h2>
            <div className="mt-0.5 text-sm text-muted-fg">Новые заявки, которые ещё надо поставить в день.</div>
          </div>
          {queue.length > 0 ? (
            <div className="divide-y divide-border">
              {queue.slice(0, 8).map((request) => <QueueCard key={request.id} request={request} />)}
            </div>
          ) : (
            <div className="p-4 text-sm text-muted-fg">Очередь пустая.</div>
          )}
        </section>
      </aside>
    </div>
  );
}

function WeekPlanner({
  days,
  requests,
  holidays,
  queueCount,
}: {
  days: string[];
  requests: ReqLite[];
  holidays: HolidayLite[];
  queueCount: number;
}) {
  return (
    <div className="grid gap-3 lg:grid-cols-7">
      {days.map((dayKey) => {
        const dayRequests = requests
          .filter((r) => r.scheduledAt.slice(0, 10) === dayKey)
          .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
        const day = parseLocalDay(dayKey);
        const holiday = holidays.find((h) => h.date === dayKey);
        return (
          <section key={dayKey} className={`rounded-2xl border p-3 ${holiday ? "border-amber-500/35 bg-amber-500/10" : "border-border bg-card/45"}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-fg">{format(day, "EEEEEE", { locale: ru })}</div>
                <div className="text-lg font-semibold">{format(day, "d MMM", { locale: ru })}</div>
              </div>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums">{dayRequests.length}</span>
            </div>
            {holiday && <div className="mt-2 text-xs text-amber-300">{holiday.reason}</div>}
            <div className="mt-3 space-y-2">
              {dayRequests.slice(0, 4).map((request) => (
                <Link key={request.id} href={`/crm/requests/${request.id}`} className="block rounded-xl border border-border bg-bg/45 px-3 py-2 hover:bg-muted">
                  <div className="font-mono text-xs text-primary">{format(parseISO(request.scheduledAt), "HH:mm")}</div>
                  <div className="mt-1 truncate text-sm font-medium">#{request.number} · {request.clientName}</div>
                  <div className="truncate text-xs text-muted-fg">{request.district || request.serviceName}</div>
                </Link>
              ))}
              {dayRequests.length > 4 && <div className="text-xs text-muted-fg">ещё {dayRequests.length - 4}</div>}
              {dayRequests.length === 0 && <div className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-xs text-muted-fg">свободно</div>}
            </div>
          </section>
        );
      })}
      {queueCount > 0 && (
        <div className="lg:col-span-7 rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary">
          В очереди без времени: {queueCount}. Откройте день, чтобы поставить их в план.
        </div>
      )}
    </div>
  );
}

function TripCard({ request, index }: { request: ReqLite; index: number }) {
  const dt = parseISO(request.scheduledAt);
  const meta = statusMeta(request.status);
  const district = request.district ? districtMeta(request.district) : null;
  const routeHref = buildRouteHref(request);

  return (
    <div className="px-4 py-4">
      <div className="flex gap-3">
        <div className="flex w-16 shrink-0 flex-col items-center">
          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-primary/35 bg-primary/12 text-sm font-semibold text-primary">{index}</div>
          <div className={`mt-2 font-mono text-sm font-semibold tabular-nums ${meta.cls.text}`}>{format(dt, "HH:mm")}</div>
          <div className="text-[10px] text-muted-fg">{request.duration} мин</div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-muted-fg">#{request.number}</span>
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
          <Link href={`/crm/requests/${request.id}`} className="mt-1 block truncate text-lg font-semibold hover:text-primary">
            {request.clientName}
          </Link>
          <div className="text-sm text-fg/85">{request.serviceName}</div>

          <div className="mt-3 grid gap-2 text-sm text-muted-fg">
            {request.address && (
              <div className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>{request.address}</span>
              </div>
            )}
            {request.masterName && (
              <div className="flex items-center gap-2">
                <UserRound className="h-4 w-4 text-muted-fg" />
                <span>{request.masterName}</span>
              </div>
            )}
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 sm:max-w-md">
            <a href={`tel:${request.phone}`} className={actionClass}>
              <Phone className="h-4 w-4" /> Позвонить
            </a>
            {routeHref && (
              <a href={routeHref} target="_blank" rel="noreferrer" className={actionClass}>
                <Navigation className="h-4 w-4" /> Маршрут
              </a>
            )}
            <Link href={`/crm/requests/${request.id}`} className={actionClass}>
              Открыть
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function QueueCard({ request }: { request: QueueReqLite }) {
  const district = request.district ? districtMeta(request.district) : null;
  return (
    <Link href={`/crm/requests/${request.id}`} className="block px-4 py-3 hover:bg-muted/25">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-muted-fg">#{request.number}</span>
            <StatusBadge status={request.status} size="sm" />
          </div>
          <div className="mt-1 truncate font-medium">{request.clientName}</div>
          <div className="mt-0.5 truncate text-sm text-muted-fg">{request.serviceName}</div>
          {request.address && <div className="mt-1 truncate text-xs text-muted-fg">{request.address}</div>}
        </div>
        {district && (
          <span
            className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{ background: `${district.color}22`, color: district.color, border: `1px solid ${district.color}55` }}
          >
            {district.name}
          </span>
        )}
      </div>
    </Link>
  );
}

function SummaryTile({ icon: Icon, label, value, hint }: { icon: typeof Route; label: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card/45 p-4">
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
    <div className="px-5 py-10 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-bg/45 text-muted-fg">
        <ListChecks className="h-5 w-5" />
      </div>
      <div className="mt-3 font-medium">На день пока ничего не поставлено</div>
      <div className="mt-1 text-sm text-muted-fg">Возьмите заявку из очереди или создайте новую в свободное окно.</div>
    </div>
  );
}

function districtCounts(requests: ReqLite[]) {
  const counts = new Map<string, number>();
  for (const request of requests) {
    if (!request.district) continue;
    counts.set(request.district, (counts.get(request.district) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

function daySummary(count: number) {
  if (count === 0) return "заявок нет";
  if (count === 1) return "1 заявка";
  if (count > 1 && count < 5) return `${count} заявки`;
  return `${count} заявок`;
}

function DayRelationBadge({ dayKey, todayKey }: { dayKey: string; todayKey: string }) {
  const relation = dayRelation(dayKey, todayKey);
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${dayRelationClass(relation, true)}`}>
      {dayRelationLabel(dayKey, todayKey)}
    </span>
  );
}

function dayRelation(dayKey: string, todayKey: string) {
  if (dayKey === todayKey) return "today";
  if (dayKey < todayKey) return "past";
  if (dayKey === toDateKey(addDays(parseLocalDay(todayKey), 1))) return "tomorrow";
  return "future";
}

function dayRelationLabel(dayKey: string, todayKey: string) {
  const relation = dayRelation(dayKey, todayKey);
  if (relation === "today") return "сегодня";
  if (relation === "tomorrow") return "завтра";
  if (dayKey === toDateKey(addDays(parseLocalDay(todayKey), -1))) return "вчера";
  if (relation === "past") return "прошло";
  return "будет";
}

function dayStripLabel(dayKey: string, todayKey: string, index: number) {
  if (dayKey === todayKey) return "сегодня";
  if (dayKey === toDateKey(addDays(parseLocalDay(todayKey), 1))) return "завтра";
  if (index === 0) return "старт";
  const relation = dayRelation(dayKey, todayKey);
  if (relation === "past") return "прошло";
  return "план";
}

function dayRelationClass(relation: string, active: boolean) {
  if (relation === "today") return "bg-primary text-primary-fg";
  if (relation === "past") return active ? "bg-zinc-500/20 text-zinc-300" : "bg-zinc-500/10 text-zinc-500";
  if (relation === "tomorrow") return "bg-sky-500/15 text-sky-300";
  return active ? "bg-primary/15 text-primary" : "bg-muted text-muted-fg";
}

function distanceFromToday(dayKey: string) {
  const day = parseLocalDay(dayKey);
  const today = parseLocalDay(toDateKey(new Date()));
  const days = Math.round((day.getTime() - today.getTime()) / 86_400_000);
  if (days === -1) return "вчера";
  if (days < -1) return `${Math.abs(days)} дн. назад`;
  if (days === 1) return "завтра";
  return `через ${days} дн.`;
}

function toDateKey(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseLocalDay(dayKey: string) {
  return new Date(`${dayKey.slice(0, 10)}T00:00:00`);
}

function openQuickAdd(scheduledAt?: string) {
  window.dispatchEvent(new CustomEvent("printcare:quickadd", { detail: { scheduledAt } }));
}

function buildRouteHref(request: Pick<ReqLite, "address" | "lat" | "lng">) {
  if (request.lat != null && request.lng != null) {
    return `https://yandex.ru/maps/?rtext=~${request.lat},${request.lng}&rtt=auto`;
  }
  if (request.address) return `https://yandex.ru/maps/?text=${encodeURIComponent(request.address)}`;
  return "";
}

const actionClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-bg/50 px-3 text-sm font-medium hover:bg-muted";
