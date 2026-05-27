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

// Палитра в духе iOS Tinted Badge: насыщенный текст + соответствующий tint-фон.
// Каждый статус — своя семантика и свой цвет, чтобы видеть с одного взгляда.
export const STATUS_META: Record<RequestStatus, StatusMeta> = {
  NEW: {
    label: "Новая",
    shortLabel: "Новая",
    cls: {
      dot: "bg-[#3B82F6]",
      bg: "bg-[#DBEAFE]",
      border: "border-[#93C5FD]",
      text: "text-[#1D4ED8]",
      ring: "ring-[#93C5FD]",
    },
    hex: "#3B82F6",
    step: 0,
    terminal: false,
  },
  ACCEPTED: {
    label: "Принята",
    shortLabel: "Принята",
    cls: {
      dot: "bg-[#22C55E]",
      bg: "bg-[#DCFCE7]",
      border: "border-[#86EFAC]",
      text: "text-[#15803D]",
      ring: "ring-[#86EFAC]",
    },
    hex: "#22C55E",
    step: 1,
    terminal: false,
  },
  SCHEDULED: {
    label: "Запланирована",
    shortLabel: "План",
    cls: {
      dot: "bg-[#6366F1]",
      bg: "bg-[#E0E7FF]",
      border: "border-[#A5B4FC]",
      text: "text-[#4338CA]",
      ring: "ring-[#A5B4FC]",
    },
    hex: "#6366F1",
    step: 1,
    terminal: false,
  },
  EN_ROUTE: {
    label: "В пути",
    shortLabel: "В пути",
    cls: {
      dot: "bg-[#0EA5E9]",
      bg: "bg-[#E0F2FE]",
      border: "border-[#7DD3FC]",
      text: "text-[#0369A1]",
      ring: "ring-[#7DD3FC]",
    },
    hex: "#0EA5E9",
    step: 2,
    terminal: false,
  },
  ON_SITE: {
    label: "На месте",
    shortLabel: "На месте",
    cls: {
      dot: "bg-[#EC4899]",
      bg: "bg-[#FCE7F3]",
      border: "border-[#F9A8D4]",
      text: "text-[#BE185D]",
      ring: "ring-[#F9A8D4]",
    },
    hex: "#EC4899",
    step: 3,
    terminal: false,
  },
  IN_PROGRESS: {
    label: "В работе",
    shortLabel: "В работе",
    cls: {
      dot: "bg-[#F97316]",
      bg: "bg-[#FFEDD5]",
      border: "border-[#FDBA74]",
      text: "text-[#9A3412]",
      ring: "ring-[#FDBA74]",
    },
    hex: "#F97316",
    step: 4,
    terminal: false,
  },
  AWAITING_PAYMENT: {
    label: "Ожидает оплаты",
    shortLabel: "Ждёт оплату",
    cls: {
      dot: "bg-[#F59E0B]",
      bg: "bg-[#FEF3C7]",
      border: "border-[#FCD34D]",
      text: "text-[#92400E]",
      ring: "ring-[#FCD34D]",
    },
    hex: "#F59E0B",
    step: 5,
    terminal: false,
  },
  DONE: {
    label: "Выполнена",
    shortLabel: "Готова",
    cls: {
      dot: "bg-[#10B981]",
      bg: "bg-[#D1FAE5]",
      border: "border-[#6EE7B7]",
      text: "text-[#065F46]",
      ring: "ring-[#6EE7B7]",
    },
    hex: "#10B981",
    step: 6,
    terminal: true,
  },
  CANCELLED: {
    label: "Отменена",
    shortLabel: "Отменена",
    cls: {
      dot: "bg-[#94A3B8]",
      bg: "bg-[#F1F5F9]",
      border: "border-[#CBD5E1]",
      text: "text-[#475569]",
      ring: "ring-[#CBD5E1]",
    },
    hex: "#94A3B8",
    step: -1,
    terminal: true,
  },
};

// Этапы конвейера для визуализации pipeline. SCHEDULED специально не отдельный
// шаг — он маппится на ACCEPTED («принята, запланирована»). См. PIPELINE_INDEX.
export const PIPELINE: RequestStatus[] = [
  "NEW",
  "ACCEPTED",
  "EN_ROUTE",
  "ON_SITE",
  "IN_PROGRESS",
  "AWAITING_PAYMENT",
  "DONE",
];

/** Текущая позиция статуса в PIPELINE (для рендера прогресса). */
export const PIPELINE_INDEX: Record<string, number> = {
  NEW: 0,
  ACCEPTED: 1,
  SCHEDULED: 1,
  EN_ROUTE: 2,
  ON_SITE: 3,
  IN_PROGRESS: 4,
  AWAITING_PAYMENT: 5,
  DONE: 6,
};

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
