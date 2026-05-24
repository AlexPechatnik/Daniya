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
      dot: "bg-[#2563EB]",
      bg: "bg-[#EFF6FF]",
      border: "border-[#BFDBFE]",
      text: "text-[#1D4ED8]",
      ring: "ring-[#BFDBFE]",
    },
    hex: "#1D4ED8",
    step: 0,
    terminal: false,
  },
  ACCEPTED: {
    label: "Принята",
    shortLabel: "Принята",
    cls: {
      dot: "bg-[#16A34A]",
      bg: "bg-[#F0FDF4]",
      border: "border-[#BBF7D0]",
      text: "text-[#15803D]",
      ring: "ring-[#BBF7D0]",
    },
    hex: "#15803D",
    step: 1,
    terminal: false,
  },
  SCHEDULED: {
    label: "Запланирована",
    shortLabel: "План",
    cls: {
      dot: "bg-[#4F46E5]",
      bg: "bg-[#EEF2FF]",
      border: "border-[#C7D2FE]",
      text: "text-[#3730A3]",
      ring: "ring-[#C7D2FE]",
    },
    hex: "#3730A3",
    step: 1,
    terminal: false,
  },
  EN_ROUTE: {
    label: "В пути",
    shortLabel: "В пути",
    cls: {
      dot: "bg-[#0284C7]",
      bg: "bg-[#E0F2FE]",
      border: "border-[#BAE6FD]",
      text: "text-[#0369A1]",
      ring: "ring-[#BAE6FD]",
    },
    hex: "#0369A1",
    step: 2,
    terminal: false,
  },
  ON_SITE: {
    label: "На месте",
    shortLabel: "На месте",
    cls: {
      dot: "bg-[#9333EA]",
      bg: "bg-[#F3E8FF]",
      border: "border-[#E9D5FF]",
      text: "text-[#7E22CE]",
      ring: "ring-[#E9D5FF]",
    },
    hex: "#7E22CE",
    step: 3,
    terminal: false,
  },
  IN_PROGRESS: {
    label: "В работе",
    shortLabel: "В работе",
    cls: {
      dot: "bg-[#EA580C]",
      bg: "bg-[#FFF7ED]",
      border: "border-[#FED7AA]",
      text: "text-[#C2410C]",
      ring: "ring-[#FED7AA]",
    },
    hex: "#C2410C",
    step: 4,
    terminal: false,
  },
  AWAITING_PAYMENT: {
    label: "Ожидает оплаты",
    shortLabel: "Ждет оплату",
    cls: {
      dot: "bg-[#D97706]",
      bg: "bg-[#FEF3C7]",
      border: "border-[#FDE68A]",
      text: "text-[#92400E]",
      ring: "ring-[#FDE68A]",
    },
    hex: "#92400E",
    step: 5,
    terminal: false,
  },
  DONE: {
    label: "Выполнена",
    shortLabel: "Готова",
    cls: {
      dot: "bg-[#16A34A]",
      bg: "bg-[#DCFCE7]",
      border: "border-[#BBF7D0]",
      text: "text-[#166534]",
      ring: "ring-[#BBF7D0]",
    },
    hex: "#166534",
    step: 6,
    terminal: true,
  },
  CANCELLED: {
    label: "Отменена",
    shortLabel: "Отменена",
    cls: {
      dot: "bg-[#64748B]",
      bg: "bg-[#F1F5F9]",
      border: "border-[#CBD5E1]",
      text: "text-[#64748B]",
      ring: "ring-[#CBD5E1]",
    },
    hex: "#64748B",
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
