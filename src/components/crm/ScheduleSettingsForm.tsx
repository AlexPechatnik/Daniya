"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, Save, AlertTriangle } from "lucide-react";
import type { ScheduleSettings } from "@/lib/settings";

export function ScheduleSettingsForm({ initial }: { initial: ScheduleSettings }) {
  const router = useRouter();
  const [s, setS] = useState<ScheduleSettings>(initial);
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function update<K extends keyof ScheduleSettings>(k: K, v: ScheduleSettings[K]) {
    setS((prev) => ({ ...prev, [k]: v }));
  }

  async function save() {
    setPending(true);
    setMsg(null);
    const res = await fetch("/api/settings/schedule", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(s),
    });
    setPending(false);
    if (res.ok) {
      setMsg({ ok: true, text: "Сохранено" });
      router.refresh();
    } else {
      setMsg({ ok: false, text: "Ошибка сохранения" });
    }
  }

  return (
    <div className="max-w-3xl space-y-5">
      {/* Будни */}
      <div className="card p-5 lg:p-6">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="h-4 w-4 text-primary" />
          <div className="font-semibold">Будни (Пн–Пт)</div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Начало">
            <input type="time" className="input" value={s.workStart} onChange={(e) => update("workStart", e.target.value)} />
          </Field>
          <Field label="Конец">
            <input type="time" className="input" value={s.workEnd} onChange={(e) => update("workEnd", e.target.value)} />
          </Field>
        </div>
      </div>

      {/* Выходные */}
      <div className="card p-5 lg:p-6">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="h-4 w-4 text-primary" />
          <div className="font-semibold">Суббота</div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Начало">
            <input type="time" className="input" value={s.saturdayStart} onChange={(e) => update("saturdayStart", e.target.value)} />
          </Field>
          <Field label="Конец">
            <input type="time" className="input" value={s.saturdayEnd} onChange={(e) => update("saturdayEnd", e.target.value)} />
          </Field>
        </div>
        <label className="mt-5 flex items-center gap-2.5 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={s.sundayActive}
            onChange={(e) => update("sundayActive", e.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          <span>Работаем по воскресеньям (те же часы что в будни)</span>
        </label>
      </div>

      {/* Слоты */}
      <div className="card p-5 lg:p-6">
        <div className="font-semibold mb-1">Длительность визита</div>
        <p className="text-xs text-muted-fg mb-4 leading-relaxed">
          Сколько времени резервируется на один заказ — заправка + дорога + буфер. Это основа для расчёта свободных окон в календаре.
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Минут на заказ" hint="включая дорогу — типично 60–90">
            <input
              type="number"
              min={15}
              max={240}
              step={5}
              className="input"
              value={s.slotMinutes}
              onChange={(e) => update("slotMinutes", parseInt(e.target.value) || 70)}
            />
          </Field>
          <Field label="Шаг сетки" hint="через сколько минут предлагается следующий слот">
            <select
              className="input"
              value={s.slotStepMinutes}
              onChange={(e) => update("slotStepMinutes", parseInt(e.target.value))}
            >
              <option value={15}>15 минут</option>
              <option value={30}>30 минут</option>
              <option value={60}>60 минут</option>
            </select>
          </Field>
        </div>
      </div>

      {/* Логика «сегодня/завтра» */}
      <div className="card p-5 lg:p-6">
        <div className="font-semibold mb-1">Запись «на сегодня»</div>
        <p className="text-xs text-muted-fg mb-4 leading-relaxed">
          После этого часа бот не предлагает клиенту сегодняшний день — переходит на следующий рабочий.
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Часовая отсечка" hint="0–23, обычно 11">
            <input
              type="number"
              min={0}
              max={23}
              className="input"
              value={s.todayCutoffHour}
              onChange={(e) => update("todayCutoffHour", parseInt(e.target.value) || 11)}
            />
          </Field>
          <Field label="Запас от «сейчас»" hint="минимум минут до первого слота сегодня">
            <input
              type="number"
              min={0}
              max={240}
              step={15}
              className="input"
              value={s.minLeadMinutes}
              onChange={(e) => update("minLeadMinutes", parseInt(e.target.value) || 60)}
            />
          </Field>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={pending} className="btn-primary">
          <Save className="h-4 w-4" /> {pending ? "Сохранение…" : "Сохранить"}
        </button>
        {msg && (
          <div className={`text-sm flex items-center gap-2 ${msg.ok ? "font-medium text-[#166534]" : "text-danger"}`}>
            {!msg.ok && <AlertTriangle className="h-4 w-4" />}
            {msg.text}
          </div>
        )}
      </div>

      <div className="card p-4 text-xs text-muted-fg leading-relaxed">
        <span className="text-fg font-medium">Праздники</span> — отдельно в <a href="/crm/settings/holidays" className="text-primary underline">Нерабочих днях</a>. Если день отмечен там — он считается выходным и слотов на него не предлагается.
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-xs font-medium text-muted-fg mb-1.5 uppercase tracking-wider">{label}</div>
      {children}
      {hint && <div className="text-[10px] text-muted-fg mt-1.5">{hint}</div>}
    </label>
  );
}
