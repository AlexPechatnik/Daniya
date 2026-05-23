"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Request, Service, User } from "@prisma/client";
import { CalendarDays, ChevronDown, Save, X } from "lucide-react";
import { addDays, format, isSameDay, setHours, setMinutes } from "date-fns";
import { ru } from "date-fns/locale";
import { AutocompleteInput } from "./AutocompleteInput";

const statuses = [
  { value: "NEW", label: "Новая" },
  { value: "ACCEPTED", label: "Принята" },
  { value: "SCHEDULED", label: "Запланирована" },
  { value: "EN_ROUTE", label: "В пути" },
  { value: "ON_SITE", label: "На месте" },
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

type RequestWithAddress = Request & {
  address?: { address: string; formattedAddress?: string | null } | null;
};

export function RequestEditor({
  request,
  services,
  masters,
}: {
  request: RequestWithAddress;
  services: Service[];
  masters: User[];
}) {
  const router = useRouter();
  const [more, setMore] = useState(false);
  const [pending, setPending] = useState(false);
  const [form, setForm] = useState({
    status: request.status,
    paymentStatus: request.paymentStatus,
    serviceId: request.serviceId || "",
    assignedToId: request.assignedToId || "",
    scheduledAt: request.scheduledAt ? toLocalDateTimeInputValue(new Date(request.scheduledAt)) : "",
    durationMin: request.durationMin,
    printerInfo: request.printerInfo || "",
    address: request.address?.address || "",
    price: request.price ? Math.round(request.price / 100) : 0,
    comment: request.comment || "",
  });

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
    <div className="rounded-2xl border border-border bg-card/45 overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="font-semibold">Заявка</div>
        <button onClick={save} disabled={pending} className="btn-primary h-10 px-4 text-sm">
          <Save className="h-4 w-4" /> {pending ? "Сохраняю" : "Сохранить"}
        </button>
      </div>

      <div className="space-y-5 p-4">
        <FormRow label="Адрес">
          <AutocompleteInput
            endpoint="/api/suggest/addresses"
            value={form.address}
            onChange={(address) => setForm({ ...form, address })}
            placeholder="Куда ехать"
            minLength={3}
            className="clean-input h-12"
          />
        </FormRow>

        <FormRow label="Услуга">
          <ChoiceGrid
            items={[{ value: "", label: "Не выбрана" }, ...services.map((service) => ({ value: service.id, label: service.name }))]}
            value={form.serviceId}
            onChange={(serviceId) => setForm({ ...form, serviceId })}
          />
        </FormRow>

        <FormRow label="Когда">
          <SchedulePicker value={form.scheduledAt} onChange={(scheduledAt) => setForm({ ...form, scheduledAt })} />
        </FormRow>

        <FormRow label="Мастер">
          <ChoiceGrid
            items={[{ value: "", label: "Не назначен" }, ...masters.map((master) => ({ value: master.id, label: master.name }))]}
            value={form.assignedToId}
            onChange={(assignedToId) => setForm({ ...form, assignedToId })}
          />
        </FormRow>

        <FormRow label="Описание">
          <AutocompleteInput
            endpoint="/api/suggest/equipment"
            value={form.printerInfo}
            onChange={(printerInfo) => setForm({ ...form, printerInfo })}
            placeholder="Картридж или принтер: HP CF283A, Canon LBP..."
            minLength={2}
            className="clean-input h-12"
          />
          <textarea
            className="clean-input min-h-[70px] resize-none py-3"
            value={form.comment}
            onChange={(e) => setForm({ ...form, comment: e.target.value })}
            placeholder="Что случилось, что взять с собой"
          />
        </FormRow>

        <FormRow label="Оплата">
          <div className="space-y-2">
            <input
              type="number"
              inputMode="numeric"
              className="clean-input h-12"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
              placeholder="Сумма"
            />
            <Segmented
              items={payments}
              value={form.paymentStatus}
              onChange={(paymentStatus) => setForm({ ...form, paymentStatus })}
            />
          </div>
        </FormRow>

        <button
          type="button"
          onClick={() => setMore((value) => !value)}
          className="flex w-full items-center justify-between rounded-xl border border-border bg-bg/30 px-4 py-3 text-sm text-muted-fg hover:bg-muted/25 hover:text-fg"
        >
          <span>Ещё</span>
          <ChevronDown className={`h-4 w-4 transition ${more ? "rotate-180" : ""}`} />
        </button>

        {more && (
          <div className="grid gap-3 rounded-2xl border border-border bg-bg/25 p-4 md:grid-cols-3">
            <SmallField label="Статус">
              <Segmented
                items={statuses}
                value={form.status}
                onChange={(status) => setForm({ ...form, status })}
                compact
              />
            </SmallField>
            <SmallField label="Длительность">
              <input
                type="number"
                inputMode="numeric"
                className="input h-11"
                value={form.durationMin}
                onChange={(e) => setForm({ ...form, durationMin: Number(e.target.value) })}
              />
            </SmallField>
            <SmallField label="Картридж / принтер">
              <input
                className="input h-11"
                value={form.printerInfo}
                onChange={(e) => setForm({ ...form, printerInfo: e.target.value })}
                placeholder="HP CF283A"
              />
            </SmallField>
          </div>
        )}
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
    { label: format(addDays(today, 2), "EEE", { locale: ru }), date: addDays(today, 2) },
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
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="inline-flex min-h-10 items-center gap-2 text-sm">
          <CalendarDays className="h-4 w-4 text-primary" />
          {selectedDate ? (
            <span>{format(selectedDate, "d MMM, EEE", { locale: ru })} · {selectedTime}</span>
          ) : (
            <span className="text-muted-fg">Без даты</span>
          )}
        </div>
        {value && (
          <button type="button" onClick={() => onChange("")} className="btn-ghost h-9 px-2 text-xs">
            <X className="h-3.5 w-3.5" />
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
              className={`rounded-xl border px-3 py-2.5 text-sm transition ${
                active ? "border-primary bg-primary/10 text-fg" : "border-border bg-bg/45 hover:bg-muted"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-5 gap-2">
        {timeSlots.map((time) => (
          <button
            key={time}
            type="button"
            onClick={() => pickTime(time)}
            className={`rounded-xl border px-2 py-2.5 text-sm font-medium tabular-nums transition ${
              selectedTime === time ? "border-primary bg-primary/10 text-fg" : "border-border bg-bg/45 hover:bg-muted"
            }`}
          >
            {time}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <input
          type="date"
          className="input h-11"
          value={value ? value.slice(0, 10) : ""}
          onChange={(e) => {
            if (!e.target.value) return onChange("");
            const time = selectedTime || getDefaultTimeForDate(new Date(`${e.target.value}T00:00`));
            onChange(`${e.target.value}T${time}`);
          }}
        />
        <input type="time" className="input h-11" value={selectedTime} onChange={(e) => pickTime(e.target.value)} />
      </div>
    </div>
  );
}

function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-muted-fg">{label}</div>
      <div>{children}</div>
    </div>
  );
}

function ChoiceGrid({
  items,
  value,
  onChange,
}: {
  items: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => {
        const active = value === item.value;
        return (
          <button
            key={item.value || "empty"}
            type="button"
            onClick={() => onChange(item.value)}
            className={`min-h-11 rounded-xl border px-3 py-2 text-left text-sm font-medium transition ${
              active ? "border-primary bg-primary/12 text-fg" : "border-border bg-bg/35 text-fg/80 hover:bg-muted"
            }`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

function Segmented({
  items,
  value,
  onChange,
  compact = false,
}: {
  items: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  compact?: boolean;
}) {
  return (
    <div className={`grid gap-2 ${compact ? "grid-cols-1" : "sm:grid-cols-3"}`}>
      {items.map((item) => {
        const active = value === item.value;
        return (
          <button
            key={item.value}
            type="button"
            onClick={() => onChange(item.value)}
            className={`min-h-10 rounded-xl border px-3 py-2 text-sm font-medium transition ${
              active ? "border-primary bg-primary/12 text-fg" : "border-border bg-bg/35 text-muted-fg hover:bg-muted hover:text-fg"
            }`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

function SmallField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1.5 text-xs font-medium text-muted-fg">{label}</div>
      {children}
    </label>
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
  const pad = (input: number) => String(input).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
