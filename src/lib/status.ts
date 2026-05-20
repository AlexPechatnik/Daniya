/**
 * Единый источник правды для статусов заявок:
 * палитра, лейблы, порядок в pipeline и доступные переходы.
 *
 * Используется по всему CRM — никогда не хардкодить цвета/лейблы в компонентах.
 */

export type RequestStatus =
  | "NEW"
  | "SCHEDULED"
  | "EN_ROUTE"
  | "IN_PROGRESS"
  | "DONE"
  | "AWAITING_PAYMENT"
  | "CANCELLED";

export interface StatusMeta {
  label: string;
  shortLabel: string;
  /** для бордеров/фонов/dot — tailwind-классы */
  cls: { dot: string; bg: string; border: string; text: string; ring: string };
  /** цвет в hex для inline SVG / графиков */
  hex: string;
  /** позиция в pipeline (для отображения прогресса). −1 = вне pipeline (отменена) */
  step: number;
  /** финальные статусы — переход дальше не предлагается */
  terminal: boolean;
}

export const STATUS_META: Record<RequestStatus, StatusMeta> = {
  NEW: {
    label: "Новая",
    shortLabel: "Новая",
    cls: {
      dot: "bg-amber-500",
      bg: "bg-amber-500/15",
      border: "border-amber-500/40",
      text: "text-amber-500",
      ring: "ring-amber-500/30",
    },
    hex: "#f59e0b",
    step: 0,
    terminal: false,
  },
  SCHEDULED: {
    label: "Запланирована",
    shortLabel: "Запланирована",
    cls: {
      dot: "bg-blue-500",
      bg: "bg-blue-500/15",
      border: "border-blue-500/40",
      text: "text-blue-400",
      ring: "ring-blue-500/30",
    },
    hex: "#3b82f6",
    step: 1,
    terminal: false,
  },
  EN_ROUTE: {
    label: "В пути",
    shortLabel: "В пути",
    cls: {
      dot: "bg-sky-400",
      bg: "bg-sky-400/15",
      border: "border-sky-400/40",
      text: "text-sky-300",
      ring: "ring-sky-400/30",
    },
    hex: "#38bdf8",
    step: 2,
    terminal: false,
  },
  IN_PROGRESS: {
    label: "В работе",
    shortLabel: "В работе",
    cls: {
      dot: "bg-violet-500",
      bg: "bg-violet-500/15",
      border: "border-violet-500/40",
      text: "text-violet-400",
      ring: "ring-violet-500/30",
    },
    hex: "#8b5cf6",
    step: 3,
    terminal: false,
  },
  AWAITING_PAYMENT: {
    label: "Ожидает оплаты",
    shortLabel: "Ждёт оплату",
    cls: {
      dot: "bg-orange-500",
      bg: "bg-orange-500/15",
      border: "border-orange-500/40",
      text: "text-orange-400",
      ring: "ring-orange-500/30",
    },
    hex: "#f97316",
    step: 4,
    terminal: false,
  },
  DONE: {
    label: "Выполнена",
    shortLabel: "Готова",
    cls: {
      dot: "bg-emerald-500",
      bg: "bg-emerald-500/15",
      border: "border-emerald-500/40",
      text: "text-emerald-400",
      ring: "ring-emerald-500/30",
    },
    hex: "#10b981",
    step: 5,
    terminal: true,
  },
  CANCELLED: {
    label: "Отменена",
    shortLabel: "Отменена",
    cls: {
      dot: "bg-zinc-500",
      bg: "bg-zinc-500/15",
      border: "border-zinc-500/40",
      text: "text-zinc-400",
      ring: "ring-zinc-500/30",
    },
    hex: "#71717a",
    step: -1,
    terminal: true,
  },
};

/** Порядок статусов в pipeline (для визуализации) */
export const PIPELINE: RequestStatus[] = [
  "NEW",
  "SCHEDULED",
  "EN_ROUTE",
  "IN_PROGRESS",
  "AWAITING_PAYMENT",
  "DONE",
];

/** Следующий статус и подпись для primary-кнопки на карточке */
export function nextAction(status: RequestStatus): { next: RequestStatus; label: string } | null {
  switch (status) {
    case "NEW": return { next: "SCHEDULED", label: "Запланировать" };
    case "SCHEDULED": return { next: "EN_ROUTE", label: "Выехать" };
    case "EN_ROUTE": return { next: "IN_PROGRESS", label: "Прибыл, начать работу" };
    case "IN_PROGRESS": return { next: "AWAITING_PAYMENT", label: "Завершить работу" };
    case "AWAITING_PAYMENT": return { next: "DONE", label: "Получена оплата" };
    default: return null;
  }
}

export function statusMeta(status: string): StatusMeta {
  return STATUS_META[status as RequestStatus] || STATUS_META.NEW;
}
