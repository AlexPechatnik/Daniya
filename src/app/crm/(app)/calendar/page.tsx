import { prisma } from "@/lib/db";
import { CalendarTimeline } from "@/components/crm/CalendarTimeline";
import { CalendarPageMobile } from "@/components/crm/mobile/CalendarPageMobile";
import { RequestDrawer } from "@/components/crm/RequestDrawer";
import { startOfWeek, addDays, startOfMonth, endOfMonth } from "date-fns";
import { findFreeSlots } from "@/lib/scheduling";
import { shortenSpbAddress } from "@/lib/address";

export const dynamic = "force-dynamic";

type View = "day" | "week" | "month";

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ from?: string; view?: string; open?: string }> }) {
  const { from, view: viewRaw, open } = await searchParams;
  const view: View = (viewRaw === "week" || viewRaw === "month") ? (viewRaw as View) : "day";
  const anchor = from ? parseLocalDay(from) : new Date();

  // Диапазон загрузки заявок зависит от вида:
  //   day  → ближайшие 7 дней (для верхней полосы контекста)
  //   week → ровно неделя
  //   month → весь месяц + хвосты до полной сетки 7×6
  const weekStart = startOfWeek(anchor, { weekStartsOn: 1 });
  let rangeStart: Date;
  let rangeEnd: Date;
  if (view === "month") {
    rangeStart = startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 });
    rangeEnd = addDays(startOfWeek(endOfMonth(anchor), { weekStartsOn: 1 }), 7);
  } else {
    rangeStart = weekStart;
    rangeEnd = addDays(weekStart, 7);
  }

  const [requests, unscheduled, holidays] = await Promise.all([
    prisma.request.findMany({
      where: { scheduledAt: { gte: rangeStart, lt: rangeEnd }, status: { not: "CANCELLED" } },
      include: { client: true, service: true, address: true, assignedTo: true },
      orderBy: { scheduledAt: "asc" },
    }),
    prisma.request.findMany({
      where: { scheduledAt: null, status: { in: ["NEW", "ACCEPTED"] } },
      include: { client: true, service: true, address: true, assignedTo: true },
      orderBy: [{ createdAt: "desc" }],
      take: 30,
    }),
    prisma.holiday.findMany({ where: { date: { gte: rangeStart, lt: rangeEnd } } }),
  ]);

  // Карта (день → массив заявок) — даём в компонент готовое, чтобы не парсить там
  const days: string[] = [];
  for (let d = new Date(rangeStart); d < rangeEnd; d = addDays(d, 1)) days.push(toDateKey(d));

  // Свободные слоты считаем только для дня в режиме «день» — это дорого, не нужно
  // обсчитывать все 30+ дней месяца. Для мобайла отдельно считаем слоты для anchor.
  const visibleSlotDays = view === "day" ? [anchor] : [];
  const freeSlotsPerDay = await Promise.all(
    visibleSlotDays.map(async (d) => ({ date: toDateKey(d), slots: (await findFreeSlots(d)).map((s) => s.start.toISOString()) })),
  );
  // Для мобильной версии всегда считаем слоты anchor-дня — мобильный view
  // не зависит от view-параметра (там только «один день»).
  const mobileSlots = (await findFreeSlots(anchor)).map((s) => s.start.toISOString());
  const anchorKey = toDateKey(anchor);
  const mobileTrips = requests
    .filter((r) => r.scheduledAt && toDateKey(r.scheduledAt) === anchorKey)
    .map((r) => ({
      id: r.id,
      number: r.number,
      clientName: r.client.name,
      serviceName: r.service?.name || "—",
      address: shortenSpbAddress(r.address?.address) || "",
      district: r.address?.district || null,
      lat: r.address?.lat || null,
      lng: r.address?.lng || null,
      phone: r.client.phone,
      scheduledAt: r.scheduledAt!.toISOString(),
      duration: r.durationMin,
      status: r.status,
    }));
  const mobileQueue = unscheduled.map((r) => ({
    id: r.id,
    number: r.number,
    clientName: r.client.name,
    serviceName: r.service?.name || "—",
    address: shortenSpbAddress(r.address?.address) || "",
    status: r.status,
  }));
  const mobileHoliday = holidays.find((h) => h.date.toISOString().slice(0, 10) === anchorKey);
  const todayKey = toDateKey(new Date());

  // Drawer-режим: если в URL `?open=<id>`, грузим полную заявку и рендерим
  // справа RequestDrawer (тот же компонент, что и на странице заявок).
  // Так клик по визиту на календаре не уводит со страницы.
  const openRequest = open
    ? await prisma.request.findUnique({
        where: { id: open },
        include: {
          client: { include: { addresses: true, printers: true, channels: true } },
          address: true,
          assignedTo: true,
          service: true,
        },
      })
    : null;
  const [drawerServices, drawerMasters] = openRequest
    ? await Promise.all([
        prisma.service.findMany({ orderBy: { name: "asc" } }),
        prisma.user.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
      ])
    : [[], []];

  // Базовый querystring текущего вида календаря (без `open`) — для close-href
  // drawer'а и для ссылок на блоки.
  const baseParts: string[] = [];
  if (view !== "day") baseParts.push(`view=${view}`);
  if (from) baseParts.push(`from=${from}`);
  const baseQuery = baseParts.length ? `?${baseParts.join("&")}` : "";
  const calendarCloseHref = `/crm/calendar${baseQuery}`;

  return (
    <>
      {/* Десктоп: полный календарь с Day/Week/Month и drag&drop. */}
      <div className={`hidden lg:block space-y-5 ${openRequest ? "lg:pr-[540px]" : ""}`}>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">План выездов</h1>
          <p className="mt-1 text-sm text-muted-fg">Кто куда едет, какие заявки без времени и где есть окно.</p>
        </div>
        <CalendarTimeline
          days={days}
          requests={requests.map((r) => ({
            id: r.id,
            number: r.number,
            clientName: r.client.name,
            serviceName: r.service?.name || "—",
            address: shortenSpbAddress(r.address?.address) || "",
            district: r.address?.district || null,
            lat: r.address?.lat || null,
            lng: r.address?.lng || null,
            phone: r.client.phone,
            scheduledAt: r.scheduledAt!.toISOString(),
            duration: r.durationMin,
            status: r.status,
            masterId: r.assignedToId,
            masterName: r.assignedTo?.name || null,
          }))}
          unscheduled={unscheduled.map((r) => ({
            id: r.id,
            number: r.number,
            clientName: r.client.name,
            serviceName: r.service?.name || "—",
            address: shortenSpbAddress(r.address?.address) || "",
            district: r.address?.district || null,
            lat: r.address?.lat || null,
            lng: r.address?.lng || null,
            phone: r.client.phone,
            duration: r.durationMin,
            status: r.status,
            masterId: r.assignedToId,
            masterName: r.assignedTo?.name || null,
          }))}
          holidays={holidays.map((h) => ({ date: h.date.toISOString().slice(0, 10), reason: h.reason || "Выходной" }))}
          freeSlots={freeSlotsPerDay}
          anchor={anchorKey}
          view={view}
          openRequestId={openRequest?.id || null}
          baseQuery={baseQuery}
        />
      </div>

      {openRequest && (
        <RequestDrawer
          request={openRequest}
          services={drawerServices}
          masters={drawerMasters}
          closeHref={calendarCloseHref}
        />
      )}

      {/* Мобайл: только что важно — выезды дня, очередь, окна. Без вкладок. */}
      <div className="lg:hidden">
        <CalendarPageMobile
          anchorDayKey={anchorKey}
          todayKey={todayKey}
          trips={mobileTrips}
          queue={mobileQueue}
          freeSlots={mobileSlots}
          holiday={mobileHoliday ? { date: anchorKey, reason: mobileHoliday.reason || "Выходной" } : undefined}
        />
      </div>
    </>
  );
}

function toDateKey(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseLocalDay(dayKey: string) {
  return new Date(`${dayKey.slice(0, 10)}T00:00:00`);
}
