import { prisma } from "@/lib/db";
import { CalendarTimeline } from "@/components/crm/CalendarTimeline";
import { startOfWeek, addDays } from "date-fns";
import { findFreeSlots } from "@/lib/scheduling";
import { shortenSpbAddress } from "@/lib/address";

export const dynamic = "force-dynamic";

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ from?: string; view?: string }> }) {
  const { from, view } = await searchParams;
  const anchor = from ? parseLocalDay(from) : new Date();
  // Загружаем неделю вокруг якоря (для view=day всё равно есть запас)
  const start = startOfWeek(anchor, { weekStartsOn: 1 });
  const end = addDays(start, 7);

  const [requests, unscheduled, holidays] = await Promise.all([
    prisma.request.findMany({
      where: { scheduledAt: { gte: start, lt: end }, status: { not: "CANCELLED" } },
      include: { client: true, service: true, address: true, assignedTo: true },
      orderBy: { scheduledAt: "asc" },
    }),
    prisma.request.findMany({
      where: {
        scheduledAt: null,
        status: { in: ["NEW", "ACCEPTED"] },
      },
      include: { client: true, service: true, address: true, assignedTo: true },
      orderBy: [{ createdAt: "desc" }],
      take: 30,
    }),
    prisma.holiday.findMany({
      where: { date: { gte: start, lt: end } },
    }),
  ]);

  const days = Array.from({ length: 7 }).map((_, i) => addDays(start, i));

  // Свободные слоты на каждый день недели — для отображения в agenda как «дырки»
  const freeSlotsPerDay = await Promise.all(
    days.map(async (d) => {
      const slots = await findFreeSlots(d);
      return {
        date: toDateKey(d),
        slots: slots.map((s) => s.start.toISOString()),
      };
    }),
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">План выездов</h1>
          <p className="mt-1 text-sm text-muted-fg">Кто куда едет, какие заявки без времени и где есть окно.</p>
        </div>
      </div>
      <CalendarTimeline
        days={days.map(toDateKey)}
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
        anchor={toDateKey(anchor)}
        view={(view as any) || "day"}
      />
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
