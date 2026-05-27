import { statusMeta } from "@/lib/status";

export function StatusBadge({ status, size = "md" }: { status: string; size?: "sm" | "md" | "lg" }) {
  const m = statusMeta(status);
  const sizes = {
    sm: "px-2 py-0.5 text-[10px]",
    md: "px-2.5 py-1 text-xs",
    lg: "px-3 py-1.5 text-sm",
  }[size];
  // Tinted-flat бейдж в духе iOS: насыщенный текст + tint-фон + цветная точка.
  // Без белой обводки внутри — это давало эффект «пастельной конфеты».
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full ${m.cls.bg} ${m.cls.text} ${sizes} font-semibold`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${m.cls.dot}`} />
      {size === "sm" ? m.shortLabel : m.label}
    </span>
  );
}
