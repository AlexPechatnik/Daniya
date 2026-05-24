"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, X } from "lucide-react";
import { nextAction, statusMeta, type RequestStatus } from "@/lib/status";

/**
 * Кнопка «следующего шага» по pipeline. Цвет — будущего состояния.
 * Если статус терминальный — ничего не рендерит.
 */
export function QuickActionButton({
  requestId, status, size = "md", showCancel = false,
}: {
  requestId: string;
  status: string;
  size?: "sm" | "md" | "lg";
  showCancel?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<"next" | "cancel" | null>(null);

  const na = nextAction(status as RequestStatus);
  if (!na && !showCancel) return null;

  async function go(payload: { to?: RequestStatus; cancel?: boolean }) {
    setPending(payload.cancel ? "cancel" : "next");
    await fetch(`/api/requests/${requestId}/transition`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    setPending(null);
    router.refresh();
  }

  const meta = na ? statusMeta(na.next) : null;
  const sizes = {
    sm: "h-8 px-3 text-xs",
    md: "h-10 px-4 text-sm",
    lg: "h-12 px-5 text-base",
  }[size];

  return (
    <div className="flex items-center gap-2">
      {na && meta && (
        <button
          onClick={() => go({ to: na.next })}
          disabled={!!pending}
          className={`inline-flex items-center justify-center gap-2 rounded-xl border font-semibold shadow-sm transition hover:brightness-[0.98] hover:shadow disabled:cursor-not-allowed disabled:border-border disabled:bg-muted disabled:text-muted-fg disabled:shadow-none ${meta.cls.bg} ${meta.cls.border} ${meta.cls.text} ${sizes}`}
        >
          {pending === "next" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
          {na.label}
        </button>
      )}
      {showCancel && (
        <button
          onClick={() => { if (confirm("Отменить заявку?")) go({ cancel: true }); }}
          disabled={!!pending}
          className={`inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card font-medium text-muted-fg shadow-sm transition hover:bg-muted hover:text-fg disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-fg disabled:shadow-none ${sizes}`}
          title="Отменить"
        >
          {pending === "cancel" ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
        </button>
      )}
    </div>
  );
}
