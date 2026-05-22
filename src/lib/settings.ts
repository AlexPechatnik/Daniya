import { prisma } from "./db";

export interface ScheduleSettings {
  /** Будни: рабочие часы */
  workStart: string;       // "09:00"
  workEnd: string;         // "18:00"
  /** Суббота */
  saturdayStart: string;
  saturdayEnd: string;
  /** Воскресенье — рабочий день? */
  sundayActive: boolean;
  /** Длительность стандартного слота заказа, минут (с учётом дороги) */
  slotMinutes: number;
  /** До какого часа можно записать клиента «на сегодня» (после — следующий день) */
  todayCutoffHour: number;
  /** Шаг сетки слотов, минут (30 = слоты на :00 и :30) */
  slotStepMinutes: number;
  /** Минимальный запас от «сейчас» до первого предлагаемого слота сегодня, минут */
  minLeadMinutes: number;
}

export const DEFAULT_SCHEDULE: ScheduleSettings = {
  workStart: "09:00",
  workEnd: "18:00",
  saturdayStart: "10:00",
  saturdayEnd: "18:00",
  sundayActive: false,
  slotMinutes: 70,
  todayCutoffHour: 11,
  slotStepMinutes: 30,
  minLeadMinutes: 60,
};

const KEY = "schedule";

export async function getScheduleSettings(): Promise<ScheduleSettings> {
  const row = await prisma.appSetting.findUnique({ where: { key: KEY } });
  if (!row) return DEFAULT_SCHEDULE;
  try {
    const parsed = JSON.parse(row.value) as Partial<ScheduleSettings>;
    return { ...DEFAULT_SCHEDULE, ...parsed };
  } catch {
    return DEFAULT_SCHEDULE;
  }
}

export async function setScheduleSettings(value: Partial<ScheduleSettings>) {
  const merged = { ...(await getScheduleSettings()), ...value };
  await prisma.appSetting.upsert({
    where: { key: KEY },
    create: { key: KEY, value: JSON.stringify(merged) },
    update: { value: JSON.stringify(merged) },
  });
  return merged;
}
