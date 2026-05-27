"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { format, addDays, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Clock, MapPin, Navigation, Phone, ListChecks } from "lucide-react";
import { StatusBadge } from "../StatusBadge";
import { MobilePageHeader } from "./MobilePageHeader";
import { EmptyState } from "../EmptyState";

/**
 * Мобильный «План выездов» — лаконичный, без переключателей День/Неделя/Месяц.
 * Три раздела: «Сегодня» (выезды на день) → «Очередь без времени» → «Свободные окна».
 * Это то, что реально нужно мастеру в поле — куда ехать дальше и что без даты.
 */
type Trip = {
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
};

type QueueItem = {
  id: string;
  number: number;
  clientName: string;
  serviceName: string;
  address: string;
  status: string;
};

export function CalendarPageMobile({
  anchorDayKey,
  todayKey,
  trips,
  queue,
  freeSlots,
  holiday,
}: {
  anchorDayKey: string;
  todayKey: string;
  trips: Trip[];
  queue: QueueItem[];
  freeSlots: string[];
  holiday?: { date: string; reason: string };
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const anchor = parseLocalDay(anchorDayKey);
  const isToday = anchorDayKey === todayKey;

  function navigate(delta: number) {
    const next = addDays(anchor, delta);
    const params = new URLSearchParams(sp?.toString() || "");
    params.set("from", toDateKey(next));
    params.delete("view");
    router.push(`/crm/calendar?${params.toString()}`);
  }

  function goToday() {
    router.push("/crm/calendar");
  }

  const title = isToday
    ? "Сегодня"
    : anchorDayKey === toDateKey(addDays(parseLocalDay(todayKey), 1))
      ? "Завтра"
      : anchorDayKey === toDateKey(addDays(parseLocalDay(todayKey), -1))
        ? "Вчера"
        : format(anchor, "EEEE", { locale: ru });

  const subtitle = format(anchor, "d MMMM", { locale: ru });

  return (
    <>
      <MobilePageHeader title={title} subtitle={subtitle} />

      {/* Навигация по дням — три кнопки в одну линию */}
      <div className="mb-4 flex items-center gap-2">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Предыдущий день"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-fg shadow-sm"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={goToday}
          disabled={isToday}
          className={`inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-full border text-sm font-medium shadow-sm ${
            isToday ? "border-border bg-bg-2 text-muted-fg" : "border-primary/30 bg-primary/10 text-primary"
          }`}
        >
          {isToday ? "Это сегодня" : "К сегодня"}
        </button>
        <button
          type="button"
          onClick={() => navigate(1)}
          aria-label="Следующий день"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-fg shadow-sm"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Холидей-полоса */}
      {holiday && (
        <div className="mb-4 rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-xs font-medium text-warning">
          Нерабочий день · {holiday.reason}
        </div>
      )}

      {/* Выезды дня */}
      <section className="mb-5">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-fg">
          Выезды · {trips.length}
        </h2>
        {trips.length > 0 ? (
          <div className="space-y-2">
            {trips.map((t, i) => <TripCard key={t.id} trip={t} index={i + 1} />)}
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card">
            <EmptyState
              icon={ListChecks}
              tone="purple"
              compact
              title="На день ничего не поставлено"
              hint="Возьмите заявку из очереди или создайте новую."
            />
          </div>
        )}
      </section>

      {/* Очередь без времени */}
      {queue.length > 0 && (
        <section className="mb-5">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-fg">
            Очередь без времени · {queue.length}
          </h2>
          <div className="space-y-2">
            {queue.slice(0, 6).map((q) => <QueueCardMobile key={q.id} request={q} />)}
            {queue.length > 6 && (
              <Link
                href="/crm/requests?queue=in_queue"
                className="block rounded-xl border border-dashed border-border bg-card px-4 py-3 text-center text-xs text-muted-fg"
              >
                ещё {queue.length - 6} в очереди →
              </Link>
            )}
          </div>
        </section>
      )}

      {/* Свободные окна */}
      {freeSlots.length > 0 && (
        <section className="mb-32">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-fg">
            Свободные окна
          </h2>
          <div className="grid grid-cols-3 gap-2">
            {freeSlots.slice(0, 6).map((slot) => (
              <button
                key={slot}
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent("printcare:quickadd", { detail: { scheduledAt: slot } }))}
                className="rounded-xl border border-border bg-card py-3 text-center transition active:bg-muted/40"
              >
                <div className="font-mono text-base font-semibold text-primary">
                  {format(parseISO(slot), "HH:mm")}
                </div>
                <div className="mt-0.5 text-[10px] text-muted-fg">+ заявку</div>
              </button>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

/* ─── карточки ─────────────────────────────────────────────────── */

function TripCard({ trip, index }: { trip: Trip; index: number }) {
  const t = parseISO(trip.scheduledAt);
  const mapHref = buildMapHref(trip.address, trip.lat, trip.lng);
  return (
    <article className="rounded-2xl border border-border bg-card p-3 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex w-14 shrink-0 flex-col items-center">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
            {index}
          </div>
          <div className="mt-1 font-mono text-sm font-semibold tabular-nums">{format(t, "HH:mm")}</div>
          <div className="text-[10px] text-muted-fg">{trip.duration} мин</div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-muted-fg">#{trip.number}</span>
            <StatusBadge status={trip.status} size="sm" />
          </div>
          <Link
            href={`/crm/requests/${trip.id}`}
            className="mt-1 block truncate text-base font-semibold"
          >
            {trip.clientName}
          </Link>
          <div className="truncate text-xs text-muted-fg">{trip.serviceName}</div>
          {trip.address && (
            <div className="mt-1 flex items-start gap-1.5 text-xs">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#DC2626]" />
              <span className="truncate text-fg/85">{trip.address}</span>
            </div>
          )}

          <div className="mt-3 flex gap-2">
            <a
              href={`tel:${trip.phone}`}
              className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full border border-border bg-card text-xs font-medium text-fg"
            >
              <Phone className="h-3.5 w-3.5" /> Позвонить
            </a>
            {mapHref && (
              <a
                href={mapHref}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full border border-border bg-card text-xs font-medium text-fg"
              >
                <Navigation className="h-3.5 w-3.5" /> Маршрут
              </a>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

function QueueCardMobile({ request }: { request: QueueItem }) {
  return (
    <Link
      href={`/crm/requests/${request.id}`}
      className="block rounded-2xl border border-border bg-card p-3 shadow-sm active:bg-muted/30"
    >
      <div className="flex items-center gap-2 text-xs">
        <span className="font-mono text-muted-fg">#{request.number}</span>
        <StatusBadge status={request.status} size="sm" />
      </div>
      <div className="mt-1 truncate text-sm font-semibold">{request.clientName}</div>
      <div className="truncate text-xs text-muted-fg">{request.serviceName}</div>
      {request.address && (
        <div className="mt-1 flex items-start gap-1.5 text-xs">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#DC2626]" />
          <span className="truncate text-muted-fg">{request.address}</span>
        </div>
      )}
    </Link>
  );
}

function buildMapHref(address: string, lat?: number | null, lng?: number | null) {
  if (lat != null && lng != null) return `https://yandex.ru/maps/?rtext=~${lat},${lng}&rtt=auto`;
  if (address) return `https://yandex.ru/maps/?text=${encodeURIComponent(address)}`;
  return "";
}

function toDateKey(d: Date) {
  const p = (v: number) => String(v).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function parseLocalDay(dayKey: string) {
  return new Date(`${dayKey.slice(0, 10)}T00:00:00`);
}
