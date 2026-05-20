"use client";
import { PIPELINE, STATUS_META, statusMeta, type RequestStatus } from "@/lib/status";
import { Check } from "lucide-react";

export function StatusPipeline({ status }: { status: string }) {
  const current = statusMeta(status);
  const isCancelled = status === "CANCELLED";
  const currentStep = current.step;

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="text-xs uppercase tracking-wider text-muted-fg">Этап</div>
        {isCancelled && <span className={`text-xs font-medium ${current.cls.text}`}>Заявка отменена</span>}
      </div>
      <div className="flex items-center">
        {PIPELINE.map((s, i) => {
          const meta = STATUS_META[s];
          const done = !isCancelled && i < currentStep;
          const active = !isCancelled && i === currentStep;
          const upcoming = isCancelled || i > currentStep;
          return (
            <div key={s} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-2 min-w-0">
                <div
                  className={`relative h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-mono transition
                    ${done ? `${meta.cls.dot} text-white` : ""}
                    ${active ? `${meta.cls.dot} text-white ring-4 ${meta.cls.ring}` : ""}
                    ${upcoming ? "bg-muted border border-border text-muted-fg" : ""}`}
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                  {active && (
                    <span className="absolute inset-0 rounded-full animate-ping opacity-60"
                          style={{ background: meta.hex }} />
                  )}
                </div>
                <div className={`text-[10px] uppercase tracking-wider truncate max-w-[80px] text-center
                  ${active ? meta.cls.text + " font-semibold" : "text-muted-fg"}`}>
                  {meta.shortLabel}
                </div>
              </div>
              {i < PIPELINE.length - 1 && (
                <div className="flex-1 h-px mx-1 mb-6 bg-border relative overflow-hidden">
                  {done && <div className={`absolute inset-0 ${meta.cls.dot}`} />}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
