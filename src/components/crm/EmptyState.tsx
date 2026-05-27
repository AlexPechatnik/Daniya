import type { LucideIcon } from "lucide-react";

/**
 * Универсальный «пустой» блок: круглая цветная иконка + bold-заголовок +
 * пояснение + опциональный CTA. Заменяет голый серый текст «пусто» —
 * страница перестаёт казаться сломанной, когда данных нет.
 */
const TONES = {
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
export type EmptyTone = keyof typeof TONES;

export function EmptyState({
  icon: Icon,
  title,
  hint,
  tone = "gray",
  cta,
  compact = false,
}: {
  icon: LucideIcon;
  title: string;
  hint?: string;
  tone?: EmptyTone;
  cta?: React.ReactNode;
  /** Компактный — для маленьких сайдбаров, без больших отступов. */
  compact?: boolean;
}) {
  return (
    <div className={`flex flex-col items-center text-center ${compact ? "px-4 py-6" : "px-6 py-10"}`}>
      <div className={`mb-3 flex h-12 w-12 items-center justify-center rounded-2xl ${TONES[tone]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="font-medium text-fg">{title}</div>
      {hint && (
        <div className="mt-1 max-w-[280px] text-xs leading-relaxed text-muted-fg">{hint}</div>
      )}
      {cta && <div className="mt-4">{cta}</div>}
    </div>
  );
}
