/**
 * Единый источник правды для статусов заявок:
 * подписи, цвета, порядок pipeline и быстрые переходы.
 */

export type RequestStatus =
  | "NEW"
  | "ACCEPTED"
  | "SCHEDULED"
  | "EN_ROUTE"
  | "ON_SITE"
  | "IN_PROGRESS"
  | "DONE"
  | "AWAITING_PAYMENT"
  | "CANCELLED";

export interface StatusMeta {
  label: string;
  shortLabel: string;
  cls: { dot: string; bg: string; border: string; text: string; ring: string };
  hex: string;
  step: number;
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
  ACCEPTED: {
    label: "Принята",
    shortLabel: "Принята",
    cls: {
      dot: "bg-lime-500",
      bg: "bg-lime-500/15",
      border: "border-lime-500/40",
      text: "text-lime-400",
      ring: "ring-lime-500/30",
    },
    hex: "#84cc16",
    step: 1,
    terminal: false,
  },
  SCHEDULED: {
    label: "Запланирована",
    shortLabel: "План",
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
  ON_SITE: {
    label: "На месте",
    shortLabel: "На месте",
    cls: {
      dot: "bg-indigo-400",
      bg: "bg-indigo-400/15",
      border: "border-indigo-400/40",
      text: "text-indigo-300",
      ring: "ring-indigo-400/30",
    },
    hex: "#818cf8",
    step: 3,
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
    step: 4,
    terminal: false,
  },
  AWAITING_PAYMENT: {
    label: "Ожидает оплаты",
    shortLabel: "Ждет оплату",
    cls: {
      dot: "bg-orange-500",
      bg: "bg-orange-500/15",
      border: "border-orange-500/40",
      text: "text-orange-400",
      ring: "ring-orange-500/30",
    },
    hex: "#f97316",
    step: 5,
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
    step: 6,
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

export const PIPELINE: RequestStatus[] = [
  "NEW",
  "ACCEPTED",
  "EN_ROUTE",
  "ON_SITE",
  "IN_PROGRESS",
  "DONE",
];

export function nextAction(status: RequestStatus): { next: RequestStatus; label: string } | null {
  switch (status) {
    case "NEW":
      return { next: "ACCEPTED", label: "Принять" };
    case "ACCEPTED":
    case "SCHEDULED":
      return { next: "EN_ROUTE", label: "В пути" };
    case "EN_ROUTE":
      return { next: "ON_SITE", label: "На месте" };
    case "ON_SITE":
      return { next: "IN_PROGRESS", label: "Начать работу" };
    case "IN_PROGRESS":
      return { next: "DONE", label: "Завершено" };
    case "AWAITING_PAYMENT":
      return { next: "DONE", label: "Получена оплата" };
    default:
      return null;
  }
}

export function statusMeta(status: string): StatusMeta {
  return STATUS_META[status as RequestStatus] || STATUS_META.NEW;
}
