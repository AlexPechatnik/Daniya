import { prisma } from "@/lib/db";
import { HolidaysEditor } from "@/components/crm/HolidaysEditor";
import { startOfYear, endOfYear } from "date-fns";

export const dynamic = "force-dynamic";

export default async function HolidaysPage() {
  const now = new Date();
  const from = startOfYear(now);
  const to = endOfYear(now);
  const holidays = await prisma.holiday.findMany({
    where: { date: { gte: from, lte: to } },
    orderBy: { date: "asc" },
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Нерабочие дни</h1>
        <p className="text-sm text-muted-fg mt-1">
          В отмеченные дни нельзя создать заявку через сайт. В CRM создание возможно с предупреждением.
        </p>
      </div>
      <HolidaysEditor initialHolidays={holidays.map((h) => ({
        id: h.id, date: h.date.toISOString(), reason: h.reason || "Выходной",
      }))} />
    </div>
  );
}
