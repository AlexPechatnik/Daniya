import { prisma } from "@/lib/db";
import { StatsDashboard } from "@/components/crm/StatsDashboard";
import { addDays, addMonths, startOfDay, endOfDay, startOfMonth, endOfMonth, subDays, subMonths, startOfYear, endOfYear, eachDayOfInterval, format } from "date-fns";

export const dynamic = "force-dynamic";

const PERIODS = {
  week: { label: "Неделя", days: 7 },
  month: { label: "Месяц", days: 30 },
  quarter: { label: "Квартал", days: 90 },
  year: { label: "Год", days: 365 },
};

export default async function StatsPage({ searchParams }: { searchParams: Promise<{ period?: keyof typeof PERIODS }> }) {
  const { period = "month" } = await searchParams;
  const days = PERIODS[period]?.days ?? 30;

  const now = new Date();
  const from = startOfDay(subDays(now, days - 1));
  const to = endOfDay(now);

  // Все заявки за период
  const requests = await prisma.request.findMany({
    where: { createdAt: { gte: from, lte: to } },
    include: { service: true, client: true },
  });

  // Выполненные за период
  const done = requests.filter((r) => r.status === "DONE");
  const paid = done.filter((r) => r.paymentStatus === "PAID");
  const cancelled = requests.filter((r) => r.status === "CANCELLED");

  // Выручка
  const revenue = paid.reduce((s, r) => s + (r.price || 0), 0);

  // Средний чек
  const avgCheck = paid.length ? Math.round(revenue / paid.length) : 0;

  // Конверсия NEW → DONE
  const conversion = requests.length
    ? Math.round((done.length / requests.length) * 100)
    : 0;

  // Повторные клиенты (>=2 заявки за период)
  const clientCounts: Record<string, number> = {};
  for (const r of requests) clientCounts[r.clientId] = (clientCounts[r.clientId] || 0) + 1;
  const repeatClients = Object.values(clientCounts).filter((c) => c >= 2).length;
  const repeatRate = requests.length
    ? Math.round((repeatClients / Object.keys(clientCounts).length) * 100) || 0
    : 0;

  // Доход по дням
  const allDays = eachDayOfInterval({ start: from, end: to });
  const revenueByDay = allDays.map((d) => {
    const dayKey = format(d, "yyyy-MM-dd");
    const dayPaid = paid.filter((r) => format(r.updatedAt, "yyyy-MM-dd") === dayKey);
    return {
      date: d.toISOString(),
      label: format(d, "d MMM"),
      revenue: dayPaid.reduce((s, r) => s + (r.price || 0), 0),
      count: dayPaid.length,
    };
  });

  // По статусам (для donut)
  const byStatus: Record<string, number> = {};
  for (const r of requests) byStatus[r.status] = (byStatus[r.status] || 0) + 1;

  // Топ услуг
  const byService: Record<string, { name: string; count: number; revenue: number }> = {};
  for (const r of paid) {
    const k = r.service?.name || "Без услуги";
    if (!byService[k]) byService[k] = { name: k, count: 0, revenue: 0 };
    byService[k].count++;
    byService[k].revenue += r.price || 0;
  }
  const topServices = Object.values(byService).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

  // Топ клиентов
  const byClient: Record<string, { id: string; name: string; revenue: number; count: number }> = {};
  for (const r of paid) {
    if (!byClient[r.clientId]) byClient[r.clientId] = { id: r.clientId, name: r.client.name, revenue: 0, count: 0 };
    byClient[r.clientId].revenue += r.price || 0;
    byClient[r.clientId].count++;
  }
  const topClients = Object.values(byClient).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

  return (
    <StatsDashboard
      period={period}
      revenue={revenue}
      avgCheck={avgCheck}
      totalRequests={requests.length}
      doneCount={done.length}
      cancelledCount={cancelled.length}
      conversion={conversion}
      repeatRate={repeatRate}
      revenueByDay={revenueByDay}
      byStatus={byStatus}
      topServices={topServices}
      topClients={topClients}
    />
  );
}
