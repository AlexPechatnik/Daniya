"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Request, Service, User } from "@prisma/client";
import {
  CalendarDays,
  Check,
  ChevronDown,
  CircleDollarSign,
  Clock,
  MapPin,
  Navigation,
  Save,
  Sparkles,
  UserRound,
  Wrench,
  X,
} from "lucide-react";
import { addDays, format, isSameDay, setHours, setMinutes } from "date-fns";
import { ru } from "date-fns/locale";
import { AutocompleteInput } from "./AutocompleteInput";
import { StatusBadge } from "./StatusBadge";

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

type RequestWithDetails = Request & {
  address?: { address: string; formattedAddress?: string | null; district?: string | null; lat?: number | null; lng?: number | null } | null;
  client?: { name: string; phone: string } | null;
  service?: { name: string } | null;
  assignedTo?: { name: string } | null;
};

export function RequestEditor({
  request,
  services,
  masters,
}: {
  request: RequestWithDetails;
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

  // Подсказка совместимых картриджей по введённой технике.
  // Мастер пишет «HP M404» → CRM показывает CF259A/CF259X из каталога.
  const [cartridgeHints, setCartridgeHints] = useState<{ brand: string; model: string; hasChip: boolean }[]>([]);
  useEffect(() => {
    const q = form.printerInfo.trim();
    if (q.length < 2) { setCartridgeHints([]); return; }
    const controller = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/public/cartridges-for-printer?q=${encodeURIComponent(q)}`, { signal: controller.signal });
        const data = await res.json();
        setCartridgeHints(data.cartridges || []);
      } catch (e: any) {
        if (e?.name !== "AbortError") setCartridgeHints([]);
      }
    }, 400);
    return () => { clearTimeout(t); controller.abort(); };
  }, [form.printerInfo]);

  const selectedService = services.find((service) => service.id === form.serviceId)?.name || "Не выбрана";
  const selectedMaster = masters.find((master) => master.id === form.assignedToId)?.name || "Не назначен";
  const selectedPayment = payments.find((payment) => payment.value === form.paymentStatus)?.label || "Не оплачено";
  const selectedWhen = form.scheduledAt ? format(new Date(form.scheduledAt), "d MMMM, HH:mm", { locale: ru }) : "Без времени";
  const mapHref = useMemo(() => buildMapHref(form.address, request.address?.lat, request.address?.lng), [form.address, request.address?.lat, request.address?.lng]);

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
    <div className="space-y-5">
      <section className="rounded-3xl border border-border bg-card p-5 shadow-sm lg:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-semibold tracking-tight">Заявка #{request.number}</h2>
              <StatusBadge status={form.status} size="md" />
            </div>
            <div className="mt-2 max-w-3xl truncate text-sm text-muted-fg">
              {form.address || "Адрес пока не указан"}
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-fg">
              <span>Источник: {sourceLabel(request.source)}</span>
              <span>·</span>
              <span>Создана {format(new Date(request.createdAt), "d MMMM, HH:mm", { locale: ru })}</span>
            </div>
          </div>
          <button onClick={save} disabled={pending} className="btn-primary h-11 px-5">
            <Save className="h-4 w-4" /> {pending ? "Сохраняю" : "Сохранить"}
          </button>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr),340px]">
        <div className="space-y-5">
          <FormSection icon={MapPin} title="Адрес и клиент" hint="Куда ехать и с кем связаться. Адрес ищется с подсказками как в картах.">
            <div className="rounded-2xl border border-border bg-bg-2 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium uppercase tracking-wider text-muted-fg">Адрес</div>
                  <AutocompleteInput
                    endpoint="/api/suggest/addresses"
                    value={form.address}
                    onChange={(address) => setForm({ ...form, address })}
                    placeholder="Начните вводить улицу, дом или район"
                    minLength={3}
                    className="clean-input mt-2 h-12 text-base font-medium"
                  />
                  {request.address?.district && <div className="mt-2 text-xs text-muted-fg">Район: {request.address.district}</div>}
                </div>
                {mapHref && (
                  <a href={mapHref} target="_blank" rel="noreferrer" className="btn-outline h-10 px-3 text-xs">
                    <Navigation className="h-4 w-4" /> Карта
                  </a>
                )}
              </div>
              {request.client && (
                <div className="mt-4 grid gap-2 border-t border-border pt-4 text-sm sm:grid-cols-2">
                  <InfoLine label="Клиент" value={request.client.name} />
                  <InfoLine label="Телефон" value={request.client.phone} />
                </div>
              )}
            </div>
          </FormSection>

          <FormSection icon={Wrench} title="Услуга" hint="Выберите основной тип работы. Остальные детали можно оставить в комментарии.">
            <ChoiceGrid
              items={[{ value: "", label: "Не выбрана", hint: "Уточнить позже" }, ...services.map((service) => ({ value: service.id, label: service.name }))]}
              value={form.serviceId}
              onChange={(serviceId) => setForm({ ...form, serviceId })}
            />
          </FormSection>

          <FormSection icon={CalendarDays} title="Когда выполнить" hint="Быстрые варианты сверху, ручная дата и время ниже.">
            <SchedulePicker value={form.scheduledAt} onChange={(scheduledAt) => setForm({ ...form, scheduledAt })} />
          </FormSection>

          <FormSection icon={UserRound} title="Мастер" hint="Можно оставить без назначения, если заявка ещё в очереди.">
            <MasterGrid
              items={[{ value: "", label: "Не назначен", hint: "Оставить в очереди" }, ...masters.map((master) => ({ value: master.id, label: master.name, hint: master.role === "ADMIN" ? "Администратор" : "Мастер" }))]}
              value={form.assignedToId}
              onChange={(assignedToId) => setForm({ ...form, assignedToId })}
            />
          </FormSection>

          <FormSection icon={Sparkles} title="Описание клиента и техника" hint="Комментарий отдельно, найденная техника отдельно. Так проще понять, что взять с собой.">
            <div className="grid gap-3">
              <label className="block">
                <div className="mb-2 text-sm font-medium">Комментарий клиента</div>
                <textarea
                  className="input min-h-[96px] resize-none py-3"
                  value={form.comment}
                  onChange={(e) => setForm({ ...form, comment: e.target.value })}
                  placeholder="Что случилось, что важно уточнить, что взять с собой"
                />
              </label>
              <div className="rounded-2xl border border-border bg-bg-2 p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-medium">Найденная техника / картридж</div>
                    <div className="text-xs text-muted-fg">CRM подскажет модели из базы и прошлых заявок.</div>
                  </div>
                </div>
                <AutocompleteInput
                  endpoint="/api/suggest/equipment"
                  value={form.printerInfo}
                  onChange={(printerInfo) => setForm({ ...form, printerInfo })}
                  placeholder="Например: HP 3050, Q2612A, Canon LBP..."
                  minLength={2}
                  className="input h-12"
                />
                {cartridgeHints.length > 0 && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-muted-fg">Подходят к этому принтеру:</span>
                    {cartridgeHints.map((h) => (
                      <button
                        key={`${h.brand}-${h.model}`}
                        type="button"
                        onClick={() => setForm({ ...form, printerInfo: `${form.printerInfo.trim()}  →  ${h.brand} ${h.model}` })}
                        className="rounded-full border border-border bg-card px-2.5 py-1 font-medium hover:border-primary hover:text-primary"
                      >
                        {h.brand} {h.model}{h.hasChip ? " · чип" : ""}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </FormSection>

          <FormSection icon={CircleDollarSign} title="Стоимость и оплата" hint="Сумму можно указать после согласования или завершения работы.">
            <div className="grid gap-4 lg:grid-cols-[220px,1fr]">
              <label className="block">
                <div className="mb-2 text-sm font-medium">Стоимость заявки</div>
                <div className="relative">
                  <input
                    type="number"
                    inputMode="numeric"
                    className="input h-12 pr-10 text-lg font-semibold tabular-nums"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                    placeholder="0"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-fg">₽</span>
                </div>
                {form.price === 0 && <div className="mt-2 text-xs text-muted-fg">Укажите стоимость после согласования.</div>}
              </label>
              <div>
                <div className="mb-2 text-sm font-medium">Статус оплаты</div>
                <Segmented items={payments} value={form.paymentStatus} onChange={(paymentStatus) => setForm({ ...form, paymentStatus })} />
              </div>
            </div>
          </FormSection>

          <button
            type="button"
            onClick={() => setMore((value) => !value)}
            className="flex w-full items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 text-sm font-medium shadow-sm hover:bg-bg-2"
          >
            <span>Дополнительно</span>
            <ChevronDown className={`h-4 w-4 transition ${more ? "rotate-180" : ""}`} />
          </button>

          {more && (
            <FormSection title="Дополнительные параметры" hint="Редко используемые настройки заявки.">
              <div className="grid gap-4 md:grid-cols-2">
                <SmallField label="Статус">
                  <Segmented items={statuses} value={form.status} onChange={(status) => setForm({ ...form, status })} compact />
                </SmallField>
                <SmallField label="Длительность, минут">
                  <input
                    type="number"
                    inputMode="numeric"
                    className="input h-11"
                    value={form.durationMin}
                    onChange={(e) => setForm({ ...form, durationMin: Number(e.target.value) })}
                  />
                </SmallField>
              </div>
            </FormSection>
          )}
        </div>

        <aside className="xl:sticky xl:top-20 xl:self-start">
          <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
            <div className="text-sm font-semibold">Сводка заявки</div>
            <div className="mt-4 space-y-3 text-sm">
              <SummaryLine label="Услуга" value={selectedService} />
              <SummaryLine label="Адрес" value={form.address || "Не указан"} />
              <SummaryLine label="Когда" value={selectedWhen} />
              <SummaryLine label="Мастер" value={selectedMaster} />
              <SummaryLine label="Оплата" value={selectedPayment} />
              <SummaryLine label="Сумма" value={`${form.price || 0} ₽`} strong />
            </div>
            <div className="mt-5 grid gap-2">
              {request.client?.phone && (
                <a href={`tel:${request.client.phone}`} className="btn-outline h-11 w-full">
                  Позвонить
                </a>
              )}
              {mapHref && (
                <a href={mapHref} target="_blank" rel="noreferrer" className="btn-outline h-11 w-full">
                  Маршрут
                </a>
              )}
              <button onClick={save} disabled={pending} className="btn-primary h-11 w-full">
                <Save className="h-4 w-4" /> {pending ? "Сохраняю" : "Сохранить"}
              </button>
            </div>
          </div>
        </aside>
      </div>

      <div className="sticky bottom-3 z-20 rounded-2xl border border-border bg-card/95 p-3 shadow-lg backdrop-blur xl:hidden">
        <button onClick={save} disabled={pending} className="btn-primary h-12 w-full">
          <Save className="h-4 w-4" /> {pending ? "Сохраняю" : "Сохранить заявку"}
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
    { label: "Сегодня", sub: format(today, "d MMM", { locale: ru }), date: today },
    { label: "Завтра", sub: format(addDays(today, 1), "d MMM", { locale: ru }), date: addDays(today, 1) },
    { label: "Выбрать дату", sub: "вручную ниже", date: selectedDate || today },
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
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 rounded-2xl border border-border bg-bg-2 px-4 py-3">
        <div className="inline-flex min-h-10 items-center gap-2 text-sm">
          <CalendarDays className="h-4 w-4 text-muted-fg" />
          {selectedDate ? (
            <span className="font-medium">{format(selectedDate, "d MMMM, EEEE", { locale: ru })} · {selectedTime}</span>
          ) : (
            <span className="text-muted-fg">Время ещё не назначено</span>
          )}
        </div>
        {value && (
          <button type="button" onClick={() => onChange("")} className="btn-ghost h-9 px-2 text-xs">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {dateOptions.map((option) => {
          const active = !!selectedDate && isSameDay(selectedDate, option.date) && option.label !== "Выбрать дату";
          return (
            <button
              key={option.label}
              type="button"
              onClick={() => option.label === "Выбрать дату" ? undefined : pickDate(option.date)}
              className={`rounded-2xl border px-4 py-3 text-left transition ${
                active ? "border-transparent bg-blue-50 text-fg shadow-inner" : "border-border bg-card hover:bg-bg-2"
              }`}
            >
              <div className="flex items-center justify-between gap-2 text-sm font-medium">
                {option.label}
                {active && <Check className="h-4 w-4 text-primary" />}
              </div>
              <div className="mt-1 text-xs text-muted-fg">{option.sub}</div>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        {timeSlots.map((time) => (
          <button
            key={time}
            type="button"
            onClick={() => pickTime(time)}
            className={`min-h-10 rounded-full border px-4 text-sm font-medium tabular-nums transition ${
              selectedTime === time ? "border-transparent bg-blue-50 text-primary shadow-inner" : "border-border bg-card hover:bg-bg-2"
            }`}
          >
            {time}
          </button>
        ))}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
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

function FormSection({
  icon: Icon,
  title,
  hint,
  children,
}: {
  icon?: typeof Wrench;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-4 flex gap-3">
        {Icon && (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-muted text-muted-fg">
            <Icon className="h-4 w-4" />
          </div>
        )}
        <div>
          <h3 className="font-semibold">{title}</h3>
          {hint && <p className="mt-1 text-sm text-muted-fg">{hint}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function ChoiceGrid({
  items,
  value,
  onChange,
}: {
  items: { value: string; label: string; hint?: string }[];
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
            className={`min-h-[76px] rounded-2xl border px-4 py-3 text-left transition ${
              active ? "border-transparent bg-blue-50 shadow-inner" : "border-border bg-bg-2 hover:bg-muted"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-medium">{item.label}</div>
                {item.hint && <div className="mt-1 text-xs text-muted-fg">{item.hint}</div>}
              </div>
              {active && <Check className="h-4 w-4 shrink-0 text-primary" />}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function MasterGrid({
  items,
  value,
  onChange,
}: {
  items: { value: string; label: string; hint?: string }[];
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
            className={`rounded-2xl border p-4 text-left transition ${
              active ? "border-transparent bg-blue-50 shadow-inner" : "border-border bg-bg-2 hover:bg-muted"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                {item.label.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{item.label}</div>
                <div className="text-xs text-muted-fg">{item.hint || "сотрудник"}</div>
              </div>
              {active && <Check className="h-4 w-4 text-primary" />}
            </div>
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
    <div className={`flex flex-wrap gap-2 ${compact ? "" : ""}`}>
      {items.map((item) => {
        const active = value === item.value;
        return (
          <button
            key={item.value}
            type="button"
            onClick={() => onChange(item.value)}
            className={`min-h-10 rounded-full border px-4 text-sm font-medium transition ${
              active ? "border-transparent bg-blue-50 text-primary shadow-inner" : "border-border bg-card text-muted-fg hover:bg-bg-2 hover:text-fg"
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
      <div className="mb-2 text-sm font-medium">{label}</div>
      {children}
    </label>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-fg">{label}</div>
      <div className="mt-1 font-medium">{value}</div>
    </div>
  );
}

function SummaryLine({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border pb-3 last:border-b-0 last:pb-0">
      <span className="text-muted-fg">{label}</span>
      <span className={`max-w-[190px] text-right ${strong ? "font-semibold tabular-nums" : "font-medium"}`}>{value}</span>
    </div>
  );
}

function sourceLabel(source: string) {
  const labels: Record<string, string> = {
    WEB: "сайт",
    PHONE: "телефон",
    TELEGRAM: "Telegram",
    MAX: "Max",
  };
  return labels[source] || source;
}

function buildMapHref(address: string, lat?: number | null, lng?: number | null) {
  if (lat != null && lng != null) return `https://yandex.ru/maps/?ll=${lng},${lat}&z=17&pt=${lng},${lat}`;
  if (address) return `https://yandex.ru/maps/?text=${encodeURIComponent(address)}`;
  return "";
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
