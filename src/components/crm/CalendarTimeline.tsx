"use client";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Calendar as CalIcon, ChevronLeft, ChevronRight, Clock, MapPin, Plus, UserRound } from "lucide-react";
import { addDays, format, isSameDay, isToday, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import { statusMeta } from "@/lib/status";

interface ReqLite {
  id: string;
  number: number;
  clientName: string;
  serviceName: string;
  address: string;
  scheduledAt: string;
  duration: number;
  status: string;
  masterId: string | null;
  masterName?: string | null;
}

interface HolidayLite { date: string; reason: string }
interface FreeSlotsLite { date: string; slots: string[] }

export function CalendarTimeline({
  days, requests, holidays = [], freeSlots = [], anchor, view: initialView = "day",
}: {
  days: string[];
  requests: ReqLite[];
  holidays?: HolidayLite[];
  freeSlots?: FreeSlotsLite[];
  anchor: string;
  view?: "day" | "week";
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const view = (sp.get("view") as "day" | "week") || initialView;
  const anchorDate = parseISO(anchor);
  const activeDayKey = toDateKey(anchorDate);
  const visibleDays = view === "day" ? [activeDayKey] : days.map((d) => d.slice(0, 10));
  const visibleRequests = requests.filter((r) => visibleDays.includes(r.scheduledAt.slice(0, 10)));
  const todayCount = requests.filter((r) => r.scheduledAt.slice(0, 10) === activeDayKey).length;

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
      <div className="card p-3 md:p-4 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <button onClick={() => navigate(-1)} className="btn-ghost p-2" aria-label="Предыдущий день">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button onClick={() => router.push("/crm/calendar")} className="btn-outline gap-2 px-3">
              <CalIcon className="h-4 w-4" /> Сегодня
            </button>
            <button onClick={() => navigate(1)} className="btn-ghost p-2" aria-label="Следующий день">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="inline-flex rounded-lg border border-border bg-card/40 p-0.5">
            <button onClick={() => switchView("day")} className={`px-3 py-1.5 text-xs rounded-md transition ${view === "day" ? "bg-primary text-primary-fg" : "text-muted-fg"}`}>День</button>
            <button onClick={() => switchView("week")} className={`px-3 py-1.5 text-xs rounded-md transition ${view === "week" ? "bg-primary text-primary-fg" : "text-muted-fg"}`}>Неделя</button>
          </div>
        </div>

        <div>
          <div className="text-xl font-semibold tracking-tight">
            {view === "day"
              ? format(anchorDate, "d MMMM, EEEE", { locale: ru })
              : `${format(parseLocalDay(days[0]), "d MMM", { locale: ru })} - ${format(parseLocalDay(days[6]), "d MMMM", { locale: ru })}`}
          </div>
          <div className="text-sm text-muted-fg mt-1">
            {view === "day" ? daySummary(todayCount) : weekSummary(visibleRequests.length)}
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {days.map((iso) => {
            const dayKey = iso.slice(0, 10);
            const day = parseLocalDay(dayKey);
            const count = requests.filter((r) => r.scheduledAt.slice(0, 10) === dayKey).length;
            const holiday = holidays.find((h) => h.date.slice(0, 10) === dayKey);
            const active = dayKey === activeDayKey;
            return (
              <button
                key={dayKey}
                type="button"
                onClick={() => goToDay(dayKey)}
                className={`min-h-[74px] rounded-xl border px-1.5 py-2 text-center transition ${
                  active ? "border-primary bg-primary/15" : holiday ? "border-warning/40 bg-warning/10" : "border-border bg-card/40 hover:bg-card"
                }`}
              >
                <div className={`text-[10px] uppercase ${active ? "text-primary" : "text-muted-fg"}`}>
                  {format(day, "EEEEEE", { locale: ru })}
                </div>
                <div className={`mt-1 text-lg font-semibold tabular-nums ${active ? "text-primary" : ""}`}>
                  {format(day, "d", { locale: ru })}
                </div>
                <div className="mt-1 flex justify-center">
                  {count > 0 ? (
                    <span className="rounded-full bg-primary/20 text-primary px-1.5 py-0.5 text-[10px] tabular-nums">{count}</span>
                  ) : holiday ? (
                    <span className="h-1.5 w-1.5 rounded-full bg-warning" />
                  ) : isToday(day) ? (
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {view === "day" ? (
        <DayAgenda
          dayKey={activeDayKey}
          requests={requests}
          holiday={holidays.find((h) => h.date.slice(0, 10) === activeDayKey)}
          freeSlots={freeSlots.find((f) => f.date === activeDayKey)?.slots || []}
        />
      ) : (
        <div className="space-y-3">
          {days.map((iso) => {
            const dayKey = iso.slice(0, 10);
            const items = requests.filter((r) => r.scheduledAt.slice(0, 10) === dayKey);
            if (items.length === 0) return null;
            return (
              <DayAgenda
                key={dayKey}
                dayKey={dayKey}
                requests={requests}
                holiday={holidays.find((h) => h.date.slice(0, 10) === dayKey)}
                freeSlots={freeSlots.find((f) => f.date === dayKey)?.slots || []}
                compact
              />
            );
          })}
          {visibleRequests.length === 0 && <EmptyAgenda />}
        </div>
      )}
    </div>
  );
}

function DayAgenda({
  dayKey, requests, holiday, freeSlots = [], compact = false,
}: {
  dayKey: string;
  requests: ReqLite[];
  holiday?: HolidayLite;
  freeSlots?: string[];
  compact?: boolean;
}) {
  const day = parseLocalDay(dayKey);
  const items = requests
    .filter((r) => r.scheduledAt.slice(0, 10) === dayKey)
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));

  // Объединяем заявки и свободные слоты в одну временну́ю шкалу
  const merged: Array<{ kind: "request"; r: ReqLite } | { kind: "slot"; iso: string }> = [
    ...items.map((r) => ({ kind: "request" as const, r })),
    ...freeSlots.map((iso) => ({ kind: "slot" as const, iso })),
  ].sort((a, b) => {
    const ta = a.kind === "request" ? a.r.scheduledAt : a.iso;
    const tb = b.kind === "request" ? b.r.scheduledAt : b.iso;
    return ta.localeCompare(tb);
  });

  return (
    <section className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-3">
        <div>
          <div className="font-semibold">{compact ? format(day, "d MMMM, EEEE", { locale: ru }) : "Расписание дня"}</div>
          <div className="text-xs text-muted-fg mt-0.5">
            {items.length ? daySummary(items.length) : "Свободный день"}
            {freeSlots.length > 0 && <span className="text-emerald-400"> · {freeSlotsLabel(freeSlots.length)}</span>}
            {holiday && <span className="text-warning"> · {holiday.reason}</span>}
          </div>
        </div>
        <button
          type="button"
          onClick={() => openQuickAdd()}
          className="btn-outline px-3 py-2 text-xs gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" /> Заявка
        </button>
      </div>

      {merged.length === 0 ? (
        <EmptyAgenda holiday={holiday} />
      ) : (
        <div className="divide-y divide-border">
          {merged.map((entry) => entry.kind === "request"
            ? <AgendaCard key={entry.r.id} request={entry.r} />
            : <FreeSlotRow key={entry.iso} iso={entry.iso} />
          )}
        </div>
      )}
    </section>
  );
}

function FreeSlotRow({ iso }: { iso: string }) {
  const dt = parseISO(iso);
  return (
    <button
      type="button"
      onClick={() => openQuickAdd(iso)}
      className="w-full px-4 py-2.5 hover:bg-primary/5 transition flex items-center gap-3 text-left group"
    >
      <div className="w-14 shrink-0 text-right">
        <div className="font-mono text-sm tabular-nums text-muted-fg group-hover:text-primary">{format(dt, "HH:mm")}</div>
      </div>
      <div className="flex-1 flex items-center gap-2 text-sm text-muted-fg/70 group-hover:text-primary">
        <div className="flex-1 border-b border-dashed border-border group-hover:border-primary/40" />
        <span className="text-xs">Свободно — записать?</span>
        <Plus className="h-3.5 w-3.5" />
        <div className="flex-1 border-b border-dashed border-border group-hover:border-primary/40" />
      </div>
    </button>
  );
}

/**
 * Открывает модалку «Новая заявка» — глобальный QuickAddTrigger ловит событие
 * и показывает форму, опционально с предзаполненным временем.
 */
function openQuickAdd(scheduledAt?: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("printcare:quickadd", { detail: { scheduledAt } }));
}

function freeSlotsLabel(n: number) {
  if (n === 1) return "1 свободный слот";
  if (n > 1 && n < 5) return `${n} свободных слота`;
  return `${n} свободных слотов`;
}

function AgendaCard({ request }: { request: ReqLite }) {
  const dt = parseISO(request.scheduledAt);
  const meta = statusMeta(request.status);
  return (
    <Link href={`/crm/requests/${request.id}`} className="block px-4 py-3 hover:bg-muted/20 transition">
      <div className="flex gap-3">
        <div className="w-14 shrink-0 text-right">
          <div className={`font-mono text-sm font-semibold tabular-nums ${meta.cls.text}`}>{format(dt, "HH:mm")}</div>
          <div className="text-[10px] text-muted-fg mt-0.5">{request.duration} мин</div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="font-medium truncate">#{request.number} · {request.clientName}</div>
              <div className="text-sm text-muted-fg truncate">{request.serviceName}</div>
            </div>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] ${meta.cls.bg} ${meta.cls.text}`}>{meta.shortLabel}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-fg">
            {request.masterName && (
              <span className="inline-flex items-center gap-1 min-w-0">
                <UserRound className="h-3.5 w-3.5" /> {request.masterName}
              </span>
            )}
            {request.address && (
              <span className="inline-flex items-center gap-1 min-w-0">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{request.address}</span>
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

function EmptyAgenda({ holiday }: { holiday?: HolidayLite }) {
  return (
    <div className="px-5 py-10 text-center">
      <div className="mx-auto h-12 w-12 rounded-2xl border border-border bg-card/50 flex items-center justify-center text-muted-fg">
        <Clock className="h-5 w-5" />
      </div>
      <div className="mt-3 font-medium">{holiday ? "Нерабочий день" : "На этот день заявок нет"}</div>
      <div className="mt-1 text-sm text-muted-fg">
        {holiday ? holiday.reason : "Можно создать заявку через кнопку сверху или перенести сюда существующую."}
      </div>
    </div>
  );
}

function toDateKey(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseLocalDay(dayKey: string) {
  return new Date(`${dayKey.slice(0, 10)}T00:00:00`);
}

function daySummary(count: number) {
  if (count === 0) return "Заявок нет";
  if (count === 1) return "1 заявка";
  if (count > 1 && count < 5) return `${count} заявки`;
  return `${count} заявок`;
}

function weekSummary(count: number) {
  if (count === 0) return "На неделе заявок нет";
  return `На неделе ${daySummary(count)}`;
}
