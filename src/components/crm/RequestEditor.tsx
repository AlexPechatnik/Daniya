"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Request, Service, User } from "@prisma/client";
import { CalendarDays, Clock, Save, X } from "lucide-react";
import { addDays, format, isSameDay, setHours, setMinutes } from "date-fns";
import { ru } from "date-fns/locale";

const statuses = [
  { value: "NEW", label: "Новая" },
  { value: "SCHEDULED", label: "Запланирована" },
  { value: "EN_ROUTE", label: "В пути" },
  { value: "IN_PROGRESS", label: "В работе" },
  { value: "AWAITING_PAYMENT", label: "Ожидает оплаты" },
  { value: "DONE", label: "Выполнена" },
  { value: "CANCELLED", label: "Отменена" },
];
const payments = [
  { value: "UNPAID", label: "Не оплачено" },
  { value: "PARTIAL", label: "Частично" },
  { value: "PAID", label: "Оплачено" },
];

export function RequestEditor({ request, services, masters }: { request: Request; services: Service[]; masters: User[] }) {
  const router = useRouter();
  const [form, setForm] = useState({
    status: request.status,
    paymentStatus: request.paymentStatus,
    serviceId: request.serviceId || "",
    assignedToId: request.assignedToId || "",
    scheduledAt: request.scheduledAt ? toLocalDateTimeInputValue(new Date(request.scheduledAt)) : "",
    durationMin: request.durationMin,
    printerInfo: request.printerInfo || "",
    price: request.price ? Math.round(request.price / 100) : 0,
    comment: request.comment || "",
  });
  const [pending, setPending] = useState(false);

  async function save() {
    setPending(true);
    await fetch("/api/requests", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: request.id,
        ...form,
        serviceId: form.serviceId || null,
        assignedToId: form.assignedToId || null,
        scheduledAt: form.scheduledAt || null,
        price: form.price * 100,
        durationMin: Number(form.durationMin) || 60,
      }),
    });
    setPending(false);
    router.refresh();
  }

  return (
    <div className="card p-5 space-y-4">
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Статус">
          <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as any })}>
            {statuses.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </Field>
        <Field label="Оплата">
          <select className="input" value={form.paymentStatus} onChange={(e) => setForm({ ...form, paymentStatus: e.target.value as any })}>
            {payments.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </Field>
        <Field label="Услуга">
          <select className="input" value={form.serviceId} onChange={(e) => setForm({ ...form, serviceId: e.target.value })}>
            <option value="">—</option>
            {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <Field label="Мастер">
          <select className="input" value={form.assignedToId} onChange={(e) => setForm({ ...form, assignedToId: e.target.value })}>
            <option value="">— не назначен —</option>
            {masters.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </Field>
        <Field label="Дата и время">
          <SchedulePicker value={form.scheduledAt} onChange={(scheduledAt) => setForm({ ...form, scheduledAt })} />
        </Field>
        <Field label="Длительность, мин">
          <input type="number" className="input" value={form.durationMin} onChange={(e) => setForm({ ...form, durationMin: Number(e.target.value) })} />
        </Field>
        <Field label="Картридж / принтер">
          <input className="input" value={form.printerInfo} onChange={(e) => setForm({ ...form, printerInfo: e.target.value })} />
        </Field>
        <Field label="Цена, ₽">
          <input type="number" className="input" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} />
        </Field>
      </div>
      <Field label="Комментарий">
        <textarea className="input min-h-[80px] py-2" value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} />
      </Field>
      <div className="flex justify-end">
        <button onClick={save} disabled={pending} className="btn-primary">
          <Save className="h-4 w-4" /> {pending ? "Сохранение…" : "Сохранить"}
        </button>
      </div>
    </div>
  );
}

const timeSlots = ["10:00", "12:00", "14:00", "16:00", "18:00"];

function SchedulePicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const selectedDate = value ? new Date(value) : null;
  const selectedTime = value ? value.slice(11, 16) : "";
  const today = new Date();
  const dateOptions = [
    { label: "Сегодня", date: today },
    { label: "Завтра", date: addDays(today, 1) },
    { label: format(addDays(today, 2), "EEEEEE", { locale: ru }), date: addDays(today, 2) },
  ];

  function pickDate(date: Date) {
    const time = selectedTime || getDefaultTimeForDate(date);
    onChange(toLocalDateTimeInputValue(withTime(date, time)));
  }

  function pickTime(time: string) {
    const date = selectedDate || today;
    onChange(toLocalDateTimeInputValue(withTime(date, time)));
  }

  return (
    <div className="rounded-2xl border border-border bg-bg/40 p-3 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" />
            {selectedDate ? format(selectedDate, "d MMMM, EEEE", { locale: ru }) : "Дата не выбрана"}
          </div>
          <div className="text-xs text-muted-fg mt-0.5">
            {selectedDate ? `Выезд в ${selectedTime}` : "Можно оставить пустым и уточнить позже"}
          </div>
        </div>
        {value && (
          <button type="button" onClick={() => onChange("")} className="btn-ghost p-2 shrink-0" title="Очистить дату">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {dateOptions.map((option) => {
          const active = !!selectedDate && isSameDay(selectedDate, option.date);
          return (
            <button
              key={option.label}
              type="button"
              onClick={() => pickDate(option.date)}
              className={`rounded-xl border px-3 py-3 text-left transition ${
                active ? "border-primary bg-primary/10 text-fg" : "border-border bg-card/40 hover:bg-card"
              }`}
            >
              <div className="text-sm font-medium leading-tight">{option.label}</div>
              <div className="text-xs text-muted-fg mt-1">{format(option.date, "d MMM", { locale: ru })}</div>
            </button>
          );
        })}
      </div>

      <div>
        <div className="text-xs uppercase tracking-wider text-muted-fg mb-2 flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" /> Время
        </div>
        <div className="grid grid-cols-5 gap-2">
          {timeSlots.map((time) => (
            <button
              key={time}
              type="button"
              onClick={() => pickTime(time)}
              className={`rounded-xl border px-2 py-3 text-sm font-medium tabular-nums transition ${
                selectedTime === time ? "border-primary bg-primary/10 text-fg" : "border-border bg-card/40 hover:bg-card"
              }`}
            >
              {time}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <input
          type="date"
          className="input h-12 text-base"
          value={value ? value.slice(0, 10) : ""}
          onChange={(e) => {
            if (!e.target.value) return onChange("");
            const time = selectedTime || getDefaultTimeForDate(new Date(`${e.target.value}T00:00`));
            onChange(`${e.target.value}T${time}`);
          }}
        />
        <input
          type="time"
          className="input h-12 text-base"
          value={selectedTime}
          onChange={(e) => pickTime(e.target.value)}
        />
      </div>
    </div>
  );
}

function withTime(date: Date, time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return setMinutes(setHours(date, hours), minutes);
}

function getDefaultTimeForDate(date: Date) {
  if (!isSameDay(date, new Date())) return "10:00";
  const now = new Date();
  const nextSlot = timeSlots.find((time) => {
    const [hours, minutes] = time.split(":").map(Number);
    const slot = setMinutes(setHours(now, hours), minutes);
    return slot.getTime() > now.getTime() + 30 * 60 * 1000;
  });
  if (nextSlot) return nextSlot;
  const nextHour = Math.min(now.getHours() + 1, 23);
  return `${String(nextHour).padStart(2, "0")}:00`;
}

function toLocalDateTimeInputValue(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="block">
      <div className="text-sm font-medium mb-1.5">{label}</div>
      {children}
    </div>
  );
}
