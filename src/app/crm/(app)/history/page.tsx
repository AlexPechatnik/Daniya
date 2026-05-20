import { prisma } from "@/lib/db";
import { HistoryHeatmap } from "@/components/crm/HistoryHeatmap";
import { eachDayOfInterval, format, startOfYear, endOfYear, subDays } from "date-fns";

export const dynamic = "force-dynamic";

export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const { year } = await searchParams;
  const y = year ? parseInt(year) : new Date().getFullYear();
  const from = new Date(y, 0, 1);
  const to = new Date(y, 11, 31, 23, 59, 59);

  const done = await prisma.request.findMany({
    where: {
      status: { in: ["DONE"] },
      updatedAt: { gte: from, lte: to },
    },
    include: { client: true, service: true },
    orderBy: { updatedAt: "desc" },
  });

  // Группируем по дням
  const byDay: Record<string, { count: number; revenue: number; items: any[] }> = {};
  for (const r of done) {
    const key = format(r.updatedAt, "yyyy-MM-dd");
    if (!byDay[key]) byDay[key] = { count: 0, revenue: 0, items: [] };
    byDay[key].count++;
    byDay[key].revenue += r.paymentStatus === "PAID" ? (r.price || 0) : 0;
    if (byDay[key].items.length < 8) {
      byDay[key].items.push({
        id: r.id, number: r.number, client: r.client.name,
        service: r.service?.name, price: r.price, paid: r.paymentStatus === "PAID",
      });
    }
  }

  const allDays = eachDayOfInterval({ start: from, end: to });
  const data = allDays.map((d) => {
    const key = format(d, "yyyy-MM-dd");
    return { date: d.toISOString(), key, count: byDay[key]?.count || 0, revenue: byDay[key]?.revenue || 0 };
  });

  // Сводка
  const total = done.length;
  const totalRevenue = done.filter((r) => r.paymentStatus === "PAID").reduce((s, r) => s + (r.price || 0), 0);
  const activeDays = Object.keys(byDay).length;

  return (
    <HistoryHeatmap
      year={y}
      days={data}
      details={byDay}
      total={total}
      totalRevenue={totalRevenue}
      activeDays={activeDays}
    />
  );
}
