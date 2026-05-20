import { statusMeta } from "@/lib/status";

export function StatusBadge({ status, size = "md" }: { status: string; size?: "sm" | "md" | "lg" }) {
  const m = statusMeta(status);
  const sizes = {
    sm: "px-2 py-0.5 text-[10px]",
    md: "px-2.5 py-1 text-xs",
    lg: "px-3 py-1.5 text-sm",
  }[size];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border ${m.cls.bg} ${m.cls.border} ${m.cls.text} ${sizes} font-medium`}>
      <span className={`h-1.5 w-1.5 rounded-full ${m.cls.dot}`} />
      {size === "sm" ? m.shortLabel : m.label}
    </span>
  );
}
