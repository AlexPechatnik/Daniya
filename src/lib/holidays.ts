import { prisma } from "./db";
import { startOfDay } from "date-fns";

/** Получить список нерабочих дней в диапазоне (userId опционально — общие или для конкретного мастера). */
export async function getHolidays(from: Date, to: Date) {
  return prisma.holiday.findMany({
    where: { date: { gte: from, lte: to } },
    orderBy: { date: "asc" },
  });
}

/** Является ли дата нерабочей. Учитывает и общие (userId=null), и личные для мастера. */
export async function isHoliday(date: Date, userId?: string | null) {
  const day = startOfDay(date);
  const next = new Date(day);
  next.setDate(next.getDate() + 1);
  const found = await prisma.holiday.findFirst({
    where: {
      date: { gte: day, lt: next },
      OR: [{ userId: null }, userId ? { userId } : { userId: "____none____" }],
    },
  });
  return found ?? null;
}

export function normalizeDay(date: Date) {
  return startOfDay(date);
}
