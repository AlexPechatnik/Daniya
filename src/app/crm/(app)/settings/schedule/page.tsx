import { getScheduleSettings } from "@/lib/settings";
import { ScheduleSettingsForm } from "@/components/crm/ScheduleSettingsForm";

export const dynamic = "force-dynamic";

export default async function SchedulePage() {
  const settings = await getScheduleSettings();
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">График работы и слоты</h1>
        <p className="text-sm text-muted-fg mt-1 max-w-2xl">
          Эти настройки используются для предложения времени клиенту в боте и для подсветки свободных окон в календаре CRM.
        </p>
      </div>
      <ScheduleSettingsForm initial={settings} />
    </div>
  );
}
