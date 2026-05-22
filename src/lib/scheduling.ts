/**
 * Поиск свободных временных слотов с учётом рабочих часов, праздников
 * и уже назначенных заявок. Используется ботом для предложения времени
 * и в CRM-календаре для подсветки доступности.
 */
import {
  addDays, addMinutes, getDay, setHours, setMinutes, setSeconds, setMilliseconds,
  startOfDay, isBefore, format,
} from "date-fns";
import { prisma } from "./db";
import { getScheduleSettings, type ScheduleSettings } from "./settings";

export interface TimeInterval {
  start: Date;
  end: Date;
}

/** [start..end) рабочих часов на указанную дату, или null если день нерабочий */
export async function getWorkingHours(
  date: Date,
  settings?: ScheduleSettings,
): Promise<TimeInterval | null> {
  const s = settings || (await getScheduleSettings());

  // Holiday — общий день. Личные holidays мастеров пока не учитываем (нет масштаба).
  const day = startOfDay(date);
  const tomorrow = addDays(day, 1);
  const holiday = await prisma.holiday.findFirst({
    where: { date: { gte: day, lt: tomorrow }, userId: null },
  });
  if (holiday) return null;

  const dow = getDay(date); // 0=Вс, 6=Сб
  let startStr: string, endStr: string;
  if (dow === 0) {
    if (!s.sundayActive) return null;
    startStr = s.workStart;
    endStr = s.workEnd;
  } else if (dow === 6) {
    startStr = s.saturdayStart;
    endStr = s.saturdayEnd;
  } else {
    startStr = s.workStart;
    endStr = s.workEnd;
  }

  return {
    start: applyTime(date, startStr),
    end: applyTime(date, endStr),
  };
}

function applyTime(date: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(":").map((x) => parseInt(x, 10));
  return setMilliseconds(setSeconds(setMinutes(setHours(date, h || 0), m || 0), 0), 0);
}

/** Уже занятые интервалы на день — для подсветки конфликтов */
export async function findOccupiedSlots(date: Date): Promise<TimeInterval[]> {
  const day = startOfDay(date);
  const tomorrow = addDays(day, 1);
  const requests = await prisma.request.findMany({
    where: {
      scheduledAt: { gte: day, lt: tomorrow },
      status: { notIn: ["CANCELLED", "DONE"] },
    },
    select: { scheduledAt: true, durationMin: true },
  });
  return requests
    .filter((r) => r.scheduledAt)
    .map((r) => ({
      start: r.scheduledAt as Date,
      end: addMinutes(r.scheduledAt as Date, r.durationMin || 70),
    }));
}

interface FreeSlot {
  start: Date;
  end: Date;
}

/**
 * Свободные стартовые точки в указанный день.
 * minDuration по умолчанию = settings.slotMinutes.
 * fromTime — не предлагать раньше этого момента (для сегодня — now+minLeadMinutes).
 */
export async function findFreeSlots(
  date: Date,
  options: { minDuration?: number; fromTime?: Date } = {},
): Promise<FreeSlot[]> {
  const settings = await getScheduleSettings();
  const slotMin = options.minDuration ?? settings.slotMinutes;
  const wh = await getWorkingHours(date, settings);
  if (!wh) return [];

  const occupied = (await findOccupiedSlots(date)).sort(
    (a, b) => a.start.getTime() - b.start.getTime(),
  );

  // Стартовая граница — больше из (начало рабочих часов, fromTime, округлённое вверх)
  let cursor = wh.start;
  if (options.fromTime && options.fromTime > cursor) {
    cursor = roundUp(options.fromTime, settings.slotStepMinutes);
  } else {
    cursor = roundUp(cursor, settings.slotStepMinutes);
  }

  const slots: FreeSlot[] = [];
  while (addMinutes(cursor, slotMin) <= wh.end) {
    const slotEnd = addMinutes(cursor, slotMin);
    const conflicts = occupied.some((o) => cursor < o.end && slotEnd > o.start);
    if (!conflicts) {
      slots.push({ start: new Date(cursor), end: new Date(slotEnd) });
    }
    cursor = addMinutes(cursor, settings.slotStepMinutes);
  }
  return slots;
}

function roundUp(date: Date, stepMinutes: number): Date {
  const m = date.getMinutes();
  const rem = m % stepMinutes;
  if (rem === 0 && date.getSeconds() === 0 && date.getMilliseconds() === 0) return date;
  return setMilliseconds(setSeconds(addMinutes(date, stepMinutes - rem), 0), 0);
}

/**
 * Предложить N ближайших свободных слотов с учётом отсечки «после 11:00 уже завтра».
 * Просматривает до 14 дней вперёд.
 */
export async function proposeNextSlots(count = 5, from?: Date): Promise<Date[]> {
  const settings = await getScheduleSettings();
  const now = from || new Date();
  const cutoffPassed = now.getHours() >= settings.todayCutoffHour;

  // Стартовая дата + минимальное время для первого слота
  const startDate = cutoffPassed ? addDays(startOfDay(now), 1) : startOfDay(now);
  const startMin = cutoffPassed ? null : addMinutes(now, settings.minLeadMinutes);

  const result: Date[] = [];
  for (let i = 0; i < 14 && result.length < count; i++) {
    const day = addDays(startDate, i);
    const slots = await findFreeSlots(day, {
      fromTime: i === 0 && startMin ? startMin : undefined,
    });
    for (const s of slots) {
      result.push(s.start);
      if (result.length >= count) break;
    }
  }
  return result;
}

/** Человекочитаемый лейбл слота: «Сегодня 14:00», «Завтра 09:30», «28 мая 14:00» */
export function formatSlotLabel(slot: Date, now = new Date()): string {
  const today = startOfDay(now);
  const slotDay = startOfDay(slot);
  const diffDays = Math.round((slotDay.getTime() - today.getTime()) / 86_400_000);
  const time = format(slot, "HH:mm");
  if (diffDays === 0) return `Сегодня ${time}`;
  if (diffDays === 1) return `Завтра ${time}`;
  return `${format(slot, "d MMM")} ${time}`;
}
