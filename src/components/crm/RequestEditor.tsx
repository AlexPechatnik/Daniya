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
import { ServicePicker } from "./ServicePicker";
import { shortenSpbAddress } from "@/lib/address";

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
  /** Когда редактор живёт в узком контейнере (drawer на 520px), 2-колоночный
   *  xl-grid схлопывается на абстрактном viewport ≥1280px и расплющивает
   *  поля. compact = всегда одна колонка вне зависимости от viewport. */
  compact = false,
}: {
  request: RequestWithDetails;
  services: Service[];
  masters: User[];
  compact?: boolean;
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
    address: shortenSpbAddress(request.address?.address) || request.address?.address || "",
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

  // Save-and-back event-handler — слушает кнопку из page-level MobileBottomBar.
  // Ей удобно жить там (всегда видна снизу), а save-логика — здесь, в редакторе.
  useEffect(() => {
    async function onSaveAndBack() {
      await save();
      router.push("/crm/requests");
    }
    window.addEventListener("printcare:request:save-and-back", onSaveAndBack);
    return () => window.removeEventListener("printcare:request:save-and-back", onSaveAndBack);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-5">
      {/* Hero-полоса под заголовком страницы: мета-инфа + основное действие.
          На мобайле — стек (текст не сжимается из-за кнопки), на десктопе — в строку. */}
      <section className="rounded-3xl border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-fg">
              {form.address || <span className="text-muted-fg">Адрес пока не указан</span>}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-fg">
              <span>Источник: {sourceLabel(request.source)}</span>
              <span aria-hidden>·</span>
              <span>Создана {format(new Date(request.createdAt), "d MMMM, HH:mm", { locale: ru })}</span>
            </div>
          </div>
          {/* Save в hero-полосе — только на десктопе. На мобайле есть единая
              кнопка снизу страницы (внизу RequestEditor), не дублируем. */}
          <button
            onClick={save}
            disabled={pending}
            className="btn-primary hidden h-11 px-5 sm:inline-flex"
          >
            <Save className="h-4 w-4" /> {pending ? "Сохраняю" : "Сохранить"}
          </button>
        </div>
      </section>

      {/* На мобайле — явный grid-cols-1, иначе grid item размеряется content-intrinsic
          и секции внутри выезжают за viewport. На xl возвращаем 2-колоночный layout —
          кроме compact-режима (drawer 520px), где 2 колонки не помещаются. */}
      <div className={`grid grid-cols-1 gap-5 ${compact ? "" : "xl:grid-cols-[minmax(0,1fr),340px]"}`}>
        <div className="space-y-5 min-w-0">
          <FormSection icon={MapPin} tone="red" title="Адрес и клиент" hint="Куда ехать и с кем связаться. Адрес ищется с подсказками как в картах.">
            <div className="rounded-2xl border border-border bg-bg-2 p-3 md:p-4">
              <div className="flex items-start justify-between gap-2">
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
                  <a href={mapHref} target="_blank" rel="noreferrer" className="btn-outline h-10 shrink-0 px-3 text-xs">
                    <Navigation className="h-4 w-4" /> <span className="hidden sm:inline">Карта</span>
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

          <FormSection icon={Wrench} tone="orange" title="Услуга" hint="Выберите основной тип работы. Остальные детали можно оставить в комментарии.">
            <ServicePicker
              items={[
                { value: "", label: "Не выбрана", hint: "Уточнить позже" },
                ...services.map((service) => ({
                  value: service.id,
                  label: service.name,
                  category: (service as any).category as string | null | undefined,
                })),
              ]}
              value={form.serviceId}
              onChange={(serviceId) => setForm({ ...form, serviceId })}
            />
          </FormSection>

          <FormSection icon={CalendarDays} tone="purple" title="Когда выполнить" hint="Быстрые варианты сверху, ручная дата и время ниже.">
            <SchedulePicker value={form.scheduledAt} onChange={(scheduledAt) => setForm({ ...form, scheduledAt })} />
          </FormSection>

          <FormSection icon={UserRound} tone="blue" title="Мастер" hint="Можно оставить без назначения, если заявка ещё в очереди.">
            <MasterGrid
              items={[{ value: "", label: "Не назначен", hint: "Оставить в очереди" }, ...masters.map((master) => ({ value: master.id, label: master.name, hint: master.role === "ADMIN" ? "Администратор" : "Мастер" }))]}
              value={form.assignedToId}
              onChange={(assignedToId) => setForm({ ...form, assignedToId })}
            />
          </FormSection>

          <FormSection icon={Sparkles} tone="teal" title="Описание клиента и техника" hint="Комментарий отдельно, найденная техника отдельно. Так проще понять, что взять с собой.">
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

          <FormSection icon={CircleDollarSign} tone="green" title="Стоимость и оплата" hint="Сумму можно указать после согласования или завершения работы.">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[220px,1fr]">
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
          {/* Hero card сводки: сумма крупно, рядом — индикатор оплаты;
              ниже — строки с цветными иконками; снизу — главные действия. */}
          <div className="overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-card to-bg-2/40 shadow-sm">
            <div className="p-5">
              <div className="text-xs uppercase tracking-wider text-muted-fg">Стоимость</div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-3xl font-semibold tabular-nums tracking-tight">
                  {(form.price || 0).toLocaleString("ru-RU")}
                </span>
                <span className="text-xl text-muted-fg">₽</span>
              </div>
              <PaymentIndicator status={form.paymentStatus} label={selectedPayment} />
            </div>

            <div className="space-y-2.5 border-t border-border/60 p-5">
              <SummaryRow icon={MapPin} tone="red" label="Адрес">
                <span className="truncate">{form.address || <span className="text-muted-fg">не указан</span>}</span>
                {mapHref && (
                  <a
                    href={mapHref}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-2 shrink-0 text-xs text-primary hover:underline"
                  >
                    Карта →
                  </a>
                )}
              </SummaryRow>
              <SummaryRow icon={CalendarDays} tone="purple" label="Когда">
                {form.scheduledAt
                  ? <span className="truncate">{selectedWhen}</span>
                  : <span className="truncate text-muted-fg">без времени</span>}
              </SummaryRow>
              <SummaryRow icon={UserRound} tone="blue" label="Мастер">
                <span className="truncate">{selectedMaster}</span>
              </SummaryRow>
              <SummaryRow icon={Wrench} tone="orange" label="Услуга">
                <span className="truncate">{selectedService}</span>
              </SummaryRow>
            </div>

            {/* В sidebar hero-card на мобайле Save и Позвонить не нужны — есть
                единая кнопка снизу страницы. На десктопе оставляем. */}
            <div className="hidden gap-2 border-t border-border/60 p-5 lg:grid">
              <button onClick={save} disabled={pending} className="btn-primary h-11 w-full">
                <Save className="h-4 w-4" /> {pending ? "Сохраняю" : "Сохранить"}
              </button>
              {request.client?.phone && (
                <a href={`tel:${request.client.phone}`} className="btn-outline h-11 w-full">
                  Позвонить
                </a>
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* Sticky-bar убрана. На lg+ — кнопки в hero-полосе и sidebar.
          На < lg — RequestPageMobile рендерит page-level MobileBottomBar,
          который диспатчит 'printcare:request:save-and-back'. */}
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

      {/* Явный grid-cols-1 на мобайле — иначе native input[type=date/time]
          с intrinsic min-width расширяет grid trace и выходит за viewport. */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <input
          type="date"
          className="input h-11 w-full"
          value={value ? value.slice(0, 10) : ""}
          onChange={(e) => {
            if (!e.target.value) return onChange("");
            const time = selectedTime || getDefaultTimeForDate(new Date(`${e.target.value}T00:00`));
            onChange(`${e.target.value}T${time}`);
          }}
        />
        <input
          type="time"
          className="input h-11 w-full"
          value={selectedTime}
          onChange={(e) => pickTime(e.target.value)}
        />
      </div>
    </div>
  );
}

// Семантическая палитра для иконок секций: каждый раздел получает свой
// цвет (как Reminders/Calendar в iOS — location красный, person синий и т.п.).
const SECTION_TONES = {
  red:    "bg-[#FEE2E2] text-[#DC2626]",
  orange: "bg-[#FFEDD5] text-[#EA580C]",
  amber:  "bg-[#FEF3C7] text-[#D97706]",
  green:  "bg-[#DCFCE7] text-[#16A34A]",
  teal:   "bg-[#CCFBF1] text-[#0D9488]",
  blue:   "bg-[#DBEAFE] text-[#2563EB]",
  indigo: "bg-[#E0E7FF] text-[#4F46E5]",
  purple: "bg-[#F3E8FF] text-[#9333EA]",
  pink:   "bg-[#FCE7F3] text-[#DB2777]",
  gray:   "bg-muted text-muted-fg",
} as const;
type SectionTone = keyof typeof SECTION_TONES;

function FormSection({
  icon: Icon,
  title,
  hint,
  tone = "gray",
  children,
}: {
  icon?: typeof Wrench;
  title: string;
  hint?: string;
  tone?: SectionTone;
  children: React.ReactNode;
}) {
  return (
    // Мобайл: меньше padding (p-4), на md+ возвращаем p-5.
    <section className="rounded-3xl border border-border bg-card p-4 shadow-sm md:p-5">
      <div className="mb-4 flex gap-3">
        {Icon && (
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl ${SECTION_TONES[tone]}`}>
            <Icon className="h-4 w-4" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold">{title}</h3>
          {hint && <p className="mt-1 text-sm leading-snug text-muted-fg">{hint}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

/** Цветная полоска слева на тайле — визуально группирует услуги по категории. */
const CATEGORY_BAR: Record<string, string> = {
  laser_refill: "bg-blue-500",
  cartridge_replacement: "bg-indigo-500",
  ciss_inkjet_service: "bg-purple-500",
  printer_repair: "bg-orange-500",
  visit_diagnostics: "bg-teal-500",
  maintenance: "bg-slate-400",
};

function ChoiceGrid({
  items,
  value,
  onChange,
}: {
  items: { value: string; label: string; hint?: string; category?: string | null }[];
  value: string;
  onChange: (value: string) => void;
}) {
  // Сортируем по категории — однотипные услуги рядом, цветные полоски
  // образуют визуальные «секции» внутри сетки.
  const sortedItems = [...items].sort((a, b) => {
    const ca = a.category || "z_other";
    const cb = b.category || "z_other";
    if (ca !== cb) return ca.localeCompare(cb);
    return a.label.localeCompare(b.label, "ru");
  });
  return (
    {/* xl:grid-cols-3 убрали: на drawer 520px xl-viewport-условие срабатывало,
        но контейнер был узким — карточки плющило, текст резался. */}
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {sortedItems.map((item) => {
        const active = value === item.value;
        const barClass = item.category ? CATEGORY_BAR[item.category] || "bg-muted" : "bg-muted";
        return (
          <button
            key={item.value || "empty"}
            type="button"
            onClick={() => onChange(item.value)}
            className={`relative min-h-[76px] overflow-hidden rounded-2xl border pl-5 pr-4 py-3 text-left transition ${
              active
                ? "border-primary/40 bg-primary/[0.06] shadow-sm"
                : "border-border bg-bg-2 hover:bg-muted hover:border-primary/20"
            }`}
          >
            {/* Цветная полоска категории слева */}
            <span className={`absolute left-0 top-0 bottom-0 w-1 ${barClass}`} aria-hidden />
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
    {/* xl:grid-cols-3 убрали: на drawer 520px xl-viewport-условие срабатывало,
        но контейнер был узким — карточки плющило, текст резался. */}
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
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

/**
 * Строка сводки заявки с цветной иконкой слева, лейблом и значением.
 * Каждая строка визуально несёт свой «семантический цвет» — Apple-style.
 */
function SummaryRow({
  icon: Icon,
  tone,
  label,
  children,
}: {
  icon: typeof Wrench;
  tone: SectionTone;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${SECTION_TONES[tone]}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] uppercase tracking-wider text-muted-fg">{label}</div>
        <div className="flex items-center font-medium">{children}</div>
      </div>
    </div>
  );
}

/**
 * Точечный индикатор статуса оплаты ●●● — три кружка как «прогресс».
 *   UNPAID  → ○ ○ ○ серый
 *   PARTIAL → ● ● ○ янтарный
 *   PAID    → ● ● ● зелёный
 */
function PaymentIndicator({ status, label }: { status: string; label: string }) {
  const filled = status === "PAID" ? 3 : status === "PARTIAL" ? 2 : 0;
  const tone =
    status === "PAID" ? "bg-emerald-500" : status === "PARTIAL" ? "bg-amber-500" : "bg-muted";
  return (
    <div className="mt-3 flex items-center gap-2">
      <div className="flex items-center gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={`h-2 w-2 rounded-full ${i < filled ? tone : "bg-muted"}`}
            aria-hidden
          />
        ))}
      </div>
      <span className="text-xs text-muted-fg">{label}</span>
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
