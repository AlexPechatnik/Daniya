import { prisma } from "@/lib/db";
import { CalendarTimeline } from "@/components/crm/CalendarTimeline";
import { startOfWeek, addDays } from "date-fns";
import { findFreeSlots } from "@/lib/scheduling";

export const dynamic = "force-dynamic";

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ from?: string; view?: string }> }) {
  const { from, view } = await searchParams;
  const anchor = from ? new Date(from) : new Date();
  // Загружаем неделю вокруг якоря (для view=day всё равно есть запас)
  const start = startOfWeek(anchor, { weekStartsOn: 1 });
  const end = addDays(start, 7);

  const [requests, holidays] = await Promise.all([
    prisma.request.findMany({
      where: { scheduledAt: { gte: start, lt: end }, status: { not: "CANCELLED" } },
      include: { client: true, service: true, address: true, assignedTo: true },
      orderBy: { scheduledAt: "asc" },
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
        date: d.toISOString().slice(0, 10),
        slots: slots.map((s) => s.start.toISOString()),
      };
    }),
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Календарь</h1>
      </div>
      <CalendarTimeline
        days={days.map((d) => d.toISOString())}
        requests={requests.map((r) => ({
          id: r.id,
          number: r.number,
          clientName: r.client.name,
          serviceName: r.service?.name || "—",
          address: r.address?.address || "",
          scheduledAt: r.scheduledAt!.toISOString(),
          duration: r.durationMin,
          status: r.status,
          masterId: r.assignedToId,
          masterName: r.assignedTo?.name || null,
        }))}
        holidays={holidays.map((h) => ({ date: h.date.toISOString().slice(0, 10), reason: h.reason || "Выходной" }))}
        freeSlots={freeSlotsPerDay}
        anchor={anchor.toISOString()}
        view={(view as any) || "day"}
      />
    </div>
  );
}
