import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getScheduleSettings, setScheduleSettings, type ScheduleSettings } from "@/lib/settings";

export async function GET() {
  return NextResponse.json(await getScheduleSettings());
}

export async function POST(req: NextRequest) {
  await requireAdmin();
  const body = (await req.json()) as Partial<ScheduleSettings>;
  // Базовая валидация
  const cleaned: Partial<ScheduleSettings> = {};
  const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (typeof body.workStart === "string" && timeRe.test(body.workStart)) cleaned.workStart = body.workStart;
  if (typeof body.workEnd === "string" && timeRe.test(body.workEnd)) cleaned.workEnd = body.workEnd;
  if (typeof body.saturdayStart === "string" && timeRe.test(body.saturdayStart)) cleaned.saturdayStart = body.saturdayStart;
  if (typeof body.saturdayEnd === "string" && timeRe.test(body.saturdayEnd)) cleaned.saturdayEnd = body.saturdayEnd;
  if (typeof body.sundayActive === "boolean") cleaned.sundayActive = body.sundayActive;
  if (typeof body.slotMinutes === "number" && body.slotMinutes >= 15 && body.slotMinutes <= 240) cleaned.slotMinutes = body.slotMinutes;
  if (typeof body.todayCutoffHour === "number" && body.todayCutoffHour >= 0 && body.todayCutoffHour <= 23) cleaned.todayCutoffHour = body.todayCutoffHour;
  if (typeof body.slotStepMinutes === "number" && [15, 30, 60].includes(body.slotStepMinutes)) cleaned.slotStepMinutes = body.slotStepMinutes;
  if (typeof body.minLeadMinutes === "number" && body.minLeadMinutes >= 0 && body.minLeadMinutes <= 240) cleaned.minLeadMinutes = body.minLeadMinutes;

  const result = await setScheduleSettings(cleaned);
  return NextResponse.json({ ok: true, settings: result });
}
