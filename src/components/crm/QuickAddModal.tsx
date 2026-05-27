"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { X, Search, Loader2, Repeat, Droplet, Replace, Stethoscope, Wrench, ChevronDown, Sparkles, AlertTriangle } from "lucide-react";
import type { Service, User } from "@prisma/client";
import { addDays, format, setHours, setMinutes } from "date-fns";
import { ru } from "date-fns/locale";
import { AutocompleteInput } from "./AutocompleteInput";

interface ClientHit {
  id: string;
  name: string;
  phone: string;
  org?: string | null;
  addresses: { id: string; address: string; label?: string | null }[];
  lastRequest: null | {
    id: string;
    serviceId: string | null;
    serviceName: string | null;
    addressId: string | null;
    addressText: string | null;
    printerInfo: string | null;
    when: string;
  };
}

const serviceIcons: Record<string, any> = {
  zapravka: Droplet,
  zamena: Replace,
  diagnostika: Stethoscope,
  remont: Wrench,
};

function dateChip(label: string, sub: string, when: () => Date) {
  return { label, sub, when };
}

/** ISO-строка → "YYYY-MM-DDTHH:mm" в локальном часовом поясе (для input type=datetime-local) */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const datePresets = [
  dateChip("Сейчас", "", () => new Date()),
  dateChip("Сегодня", "16:00", () => setMinutes(setHours(new Date(), 16), 0)),
  dateChip("Завтра", "10:00", () => setMinutes(setHours(addDays(new Date(), 1), 10), 0)),
  dateChip("Завтра", "16:00", () => setMinutes(setHours(addDays(new Date(), 1), 16), 0)),
];

export function QuickAddModal({
  onClose, services, masters, initialScheduledAt,
}: {
  onClose: () => void;
  services: Service[];
  masters: User[];
  /** ISO-строка — если передано (например, из клика по свободному слоту в календаре),
   *  модалка откроется с предзаполненным временем в режиме «Точно». */
  initialScheduledAt?: string;
}) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  // Состояние свайпа-закрытия мобильной шторки
  const [dragY, setDragY] = useState(0);
  const dragStartY = useRef<number | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Главное поле — телефон
  const [phone, setPhone] = useState("");
  const [hits, setHits] = useState<ClientHit[]>([]);
  const [pickedClient, setPickedClient] = useState<ClientHit | null>(null);
  const [searching, setSearching] = useState(false);
  const phoneRef = useRef<HTMLInputElement>(null);
  useEffect(() => { phoneRef.current?.focus(); }, []);

  // Поиск клиента
  useEffect(() => {
    if (!phone || phone.replace(/\D/g, "").length < 4) {
      setHits([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      const res = await fetch(`/api/clients/search?q=${encodeURIComponent(phone)}`);
      const data = await res.json();
      setHits(data.clients || []);
      setSearching(false);
    }, 200);
    return () => clearTimeout(t);
  }, [phone]);

  // Поля
  const [comment, setComment] = useState("");
  const [name, setName] = useState("");
  const [serviceId, setServiceId] = useState<string>("");
  const [printerInfo, setPrinterInfo] = useState("");
  // Если передано initialScheduledAt — сразу режим «Точно» с этой датой/временем
  const [datePreset, setDatePreset] = useState<number | "custom" | "none">(
    initialScheduledAt ? "custom" : "none",
  );
  const [customDate, setCustomDate] = useState(
    initialScheduledAt ? toLocalInput(initialScheduledAt) : "",
  );
  const [address, setAddress] = useState("");
  const [masterId, setMasterId] = useState(masters[0]?.id || "");
  const [showFull, setShowFull] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Нерабочие дни
  const [holidays, setHolidays] = useState<{ date: string; reason: string }[]>([]);
  useEffect(() => {
    fetch("/api/holidays").then((r) => r.json()).then((d) => setHolidays(d.holidays || []));
  }, []);

  const scheduledAt = useMemo(() => {
    if (datePreset === "none") return null;
    if (datePreset === "custom") return customDate || null;
    return datePresets[datePreset].when().toISOString();
  }, [datePreset, customDate]);

  // Проверка попадания выбранной даты в нерабочий день
  const holidayHit = useMemo(() => {
    if (!scheduledAt) return null;
    const d = new Date(scheduledAt);
    const key = d.toISOString().slice(0, 10);
    return holidays.find((h) => h.date.slice(0, 10) === key) || null;
  }, [scheduledAt, holidays]);

  async function onSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!phone.trim()) { setError("Введите телефон"); return; }
    setSubmitting(true);
    setError("");
    const body: any = {
      phone,
      name: name.trim() || pickedClient?.name,
      clientId: pickedClient?.id,
      address: pickedClient ? undefined : (address || undefined),
      addressId: pickedClient?.addresses[0]?.id,
      serviceId: serviceId || undefined,
      printerInfo: printerInfo || undefined,
      scheduledAt,
      assignedToId: masterId || undefined,
      comment: comment || undefined,
    };
    const res = await fetch("/api/requests", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    setSubmitting(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Ошибка");
      return;
    }
    onClose();
    router.refresh();
  }

  async function repeatLast(hit: ClientHit) {
    if (!hit.lastRequest) return;
    setSubmitting(true);
    setError("");
    const body: any = {
      phone: hit.phone,
      clientId: hit.id,
      addressId: hit.lastRequest.addressId,
      serviceId: hit.lastRequest.serviceId,
      printerInfo: hit.lastRequest.printerInfo,
      scheduledAt: setMinutes(setHours(new Date(), 16), 0).toISOString(),
      assignedToId: masterId || undefined,
      comment: "Повтор последней заявки",
    };
    const res = await fetch("/api/requests", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    setSubmitting(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Ошибка");
      return;
    }
    onClose();
    router.refresh();
  }

  if (!mounted) return null;

  return createPortal(
    <div
      className="crm-light fixed inset-0 z-[1000] flex items-end bg-slate-900/30 backdrop-blur-md md:items-start md:justify-center md:pt-16 animate-fade-in"
      onClick={onClose}
    >
      <form
        ref={formRef}
        onClick={(e) => e.stopPropagation()}
        onSubmit={onSubmit}
        className="
          relative w-full md:max-w-2xl bg-card border border-border shadow-2xl shadow-slate-900/18
          rounded-t-3xl md:rounded-3xl
          max-h-[92vh] md:max-h-[88vh]
          flex flex-col
          animate-fade-up
        "
        style={{
          transform: dragY > 0 ? `translateY(${dragY}px)` : undefined,
          transition: dragStartY.current == null ? "transform 200ms ease-out" : undefined,
        }}
      >
        {/* Swipe-down handle: тащишь вниз — закрывается. На десктопе скрыт. */}
        <div
          className="md:hidden flex justify-center pt-3 pb-2 touch-none"
          onTouchStart={(e) => {
            dragStartY.current = e.touches[0].clientY;
          }}
          onTouchMove={(e) => {
            if (dragStartY.current == null) return;
            const delta = e.touches[0].clientY - dragStartY.current;
            // Тянуть можно только вниз; добавляем «резинку» при сильном тяге
            setDragY(delta > 0 ? delta : delta / 4);
          }}
          onTouchEnd={() => {
            if (dragY > 100) {
              // Достаточно далеко стащили — закрываем
              onClose();
            }
            dragStartY.current = null;
            setDragY(0);
          }}
        >
          <div className="h-1.5 w-12 rounded-full bg-muted-fg/30" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 md:px-6 pt-4 pb-3 md:pt-6 md:pb-4 border-b border-border">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Новая заявка</h2>
            {!showFull && <div className="text-sm text-muted-fg mt-0.5">Быстрый режим. Можно добавить детали потом.</div>}
          </div>
          <button type="button" onClick={onClose} className="btn-ghost p-2 -mr-2"><X className="h-5 w-5" /></button>
        </div>

        {/* Прокручиваемое тело */}
        <div className="flex-1 overflow-y-auto px-5 md:px-6 py-5 space-y-5">
          {/* Телефон — самое главное поле */}
          <div>
            <Label>Телефон</Label>
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-fg" />
              <input
                ref={phoneRef}
                inputMode="tel"
                type="tel"
                autoComplete="off"
                className="input pl-10 h-12 md:h-11 text-base"
                value={phone}
                onChange={(e) => { setPhone(e.target.value); setPickedClient(null); }}
                placeholder="+7..."
              />
              {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-fg" />}
            </div>

            {/* Найденные клиенты */}
            {hits.length > 0 && !pickedClient && (
              <div className="mt-2 max-h-48 overflow-y-auto rounded-2xl border border-border bg-card divide-y divide-border shadow-lg shadow-slate-900/8">
                {hits.map((h) => (
                  <div key={h.id} className="px-3 py-2.5">
                    <button type="button" onClick={() => { setPickedClient(h); setPhone(h.phone); }} className="w-full text-left">
                      <div className="text-sm font-medium">{h.name}{h.org && <span className="text-muted-fg"> · {h.org}</span>}</div>
                      <div className="mt-0.5 text-sm text-muted-fg">{h.phone} {h.addresses[0]?.address && `· ${h.addresses[0].address}`}</div>
                    </button>
                    {h.lastRequest && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); repeatLast(h); }}
                        disabled={submitting}
                        className="mt-2 inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                      >
                        <Repeat className="h-3 w-3" />
                        Повторить: {h.lastRequest.serviceName || "услуга"}
                        {h.lastRequest.printerInfo && ` · ${h.lastRequest.printerInfo}`}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Выбранный клиент */}
            {pickedClient && (
              <div className="mt-2 flex items-start justify-between gap-3 rounded-2xl border border-transparent bg-blue-50 px-3 py-2.5">
                <div className="text-sm">
                  <div className="font-medium">{pickedClient.name}</div>
                  <div className="text-sm text-muted-fg">{pickedClient.addresses[0]?.address || "адрес уточнить"}</div>
                </div>
                <button type="button" onClick={() => setPickedClient(null)} className="text-xs text-muted-fg hover:text-fg">сменить</button>
              </div>
            )}
          </div>

          {/* Имя — только если клиент новый */}
          {!pickedClient && phone && (
            <div>
              <Label>Имя клиента <span className="text-muted-fg font-normal">(необязательно)</span></Label>
              <input
                className="input h-12 md:h-11 text-base"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Иван / ООО Ромашка"
              />
              <div className="mt-1.5 text-sm text-muted-fg">Если оставить пустым — сохраним как «Клиент {phone || "+7..."}», уточните при перезвоне.</div>
            </div>
          )}

          {/* Услуга — большие чипы */}
          <div>
            <Label>Услуга</Label>
            <div className="grid grid-cols-2 gap-2">
              {services.map((s) => {
                const Icon = serviceIcons[s.slug] || Sparkles;
                const active = serviceId === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setServiceId(active ? "" : s.id)}
                    className={`flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left text-sm transition ${
                      active ? "border-transparent bg-blue-50 text-fg shadow-inner" : "border-border bg-bg-2 text-fg hover:bg-muted"
                    }`}
                  >
                    <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${active ? "bg-white text-primary shadow-sm" : "bg-muted text-muted-fg"}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className="font-medium leading-tight">{s.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Когда — чипы */}
          <div>
            <Label>Когда</Label>
            <div className="flex flex-wrap gap-2">
              <DateChip active={datePreset === "none"} onClick={() => setDatePreset("none")}>
                <div className="font-medium">Без даты</div>
                <div className="text-[10px] text-slate-500">уточнить</div>
              </DateChip>
              {datePresets.map((d, i) => (
                <DateChip key={i} active={datePreset === i} onClick={() => setDatePreset(i)}>
                  <div className="font-medium">{d.label}</div>
                  <div className="text-[10px] text-slate-500">{d.sub || format(d.when(), "HH:mm")}</div>
                </DateChip>
              ))}
              <DateChip active={datePreset === "custom"} onClick={() => setDatePreset("custom")}>
                <div className="font-medium">Точно</div>
                <div className="text-[10px] text-slate-500">выбрать</div>
              </DateChip>
            </div>
            {datePreset === "custom" && (
              <input
                type="datetime-local"
                className="input mt-3 h-12 md:h-11"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
              />
            )}
            {holidayHit && (
              <div className="mt-3 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium">Нерабочий день — {holidayHit.reason}</div>
                  <div className="text-warning/80 mt-0.5">Создать заявку можно, но клиента стоит предупредить.</div>
                </div>
              </div>
            )}
          </div>

          {/* Картридж / комментарий — всегда виден, одно поле */}
          <div>
            <Label>Картридж / принтер</Label>
            <AutocompleteInput
              endpoint="/api/suggest/equipment"
              value={printerInfo}
              onChange={setPrinterInfo}
              placeholder="HP CF283A, Canon LBP6020..."
              minLength={2}
              className="input h-12 text-base"
            />
          </div>

          <div>
            <Label>Комментарий</Label>
            <textarea
              className="input min-h-[72px] text-base"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Мажет, второй этаж, домофон..."
            />
          </div>

          {/* Подробный режим */}
          <button
            type="button"
            onClick={() => setShowFull((v) => !v)}
            className="w-full flex items-center justify-center gap-2 rounded-2xl border border-border bg-bg-2 px-4 py-3 text-sm font-medium text-muted-fg hover:text-fg transition"
          >
            <ChevronDown className={`h-4 w-4 transition-transform ${showFull ? "rotate-180" : ""}`} />
            {showFull ? "Скрыть детали" : "Заполнить полностью (адрес, мастер, модель)"}
          </button>

          {showFull && (
            <div className="space-y-4 pt-2 border-t border-border">
              {!pickedClient && (
                <div>
                  <Label>Адрес</Label>
                  <AutocompleteInput
                    endpoint="/api/suggest/addresses"
                    value={address}
                    onChange={setAddress}
                    placeholder="Улица, дом, корпус, офис"
                    minLength={3}
                    className="input h-12 md:h-11"
                  />
                </div>
              )}
              <div>
                <Label>Мастер</Label>
                <select className="input h-12 md:h-11" value={masterId} onChange={(e) => setMasterId(e.target.value)}>
                  <option value="">— не назначен —</option>
                  {masters.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
            </div>
          )}

          {error && <div className="text-sm text-danger">{error}</div>}
        </div>

        {/* Sticky футер с кнопкой */}
        <div className="border-t border-border bg-bg-2 px-5 md:px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] flex items-center gap-3">
          <button type="button" onClick={onClose} className="btn-ghost flex-1 md:flex-none">Отмена</button>
          <button type="submit" disabled={submitting || !phone} className="btn-primary btn-glow flex-1 h-12 text-base">
            {submitting ? "Сохранение…" : "Создать заявку"}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-sm font-semibold text-muted-fg mb-2">{children}</div>;
}

function DateChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`quick-date-chip min-w-[88px] rounded-xl border px-3.5 py-2 text-sm transition ${
        active ? "border-transparent bg-blue-50 text-primary shadow-inner" : "border-border bg-card text-fg shadow-sm hover:border-slate-300 hover:bg-bg-2"
      }`}
    >
      {children}
    </button>
  );
}
