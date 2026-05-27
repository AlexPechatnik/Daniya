"use client";
import { PIPELINE, PIPELINE_INDEX, STATUS_META, statusMeta } from "@/lib/status";
import { Check, Slash } from "lucide-react";

/**
 * Прогресс заявки по этапам — multi-step bar в духе Apple Reminders / Shortcuts.
 *
 *   ✓── ✓── ●(pulse)── ○── ○── ○── ○
 *  Новая Принята  ВПути  Место Работа Оплата Готова
 *
 * - Пройденные этапы: зелёный filled с галочкой.
 * - Текущий: цвет статуса + soft-pulse ring.
 * - Будущие: пустой кружок с пунктирной обводкой.
 * - CANCELLED: отдельный «остановленный» state с диагональной линией.
 */
export function StatusPipeline({ status }: { status: string }) {
  const isCancelled = status === "CANCELLED";
  const currentIndex = isCancelled ? -1 : PIPELINE_INDEX[status] ?? 0;
  const currentMeta = statusMeta(status);

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <div className="text-xs font-medium uppercase tracking-wider text-muted-fg">Этап заявки</div>
        <div className={`text-xs font-semibold ${currentMeta.cls.text}`}>
          {isCancelled ? "Заявка отменена" : `${currentIndex + 1} из ${PIPELINE.length}`}
        </div>
      </div>

      <ol className="flex items-start">
        {PIPELINE.map((s, i) => {
          const meta = STATUS_META[s];
          const isPast = !isCancelled && i < currentIndex;
          const isCurrent = !isCancelled && i === currentIndex;
          const isFuture = isCancelled || i > currentIndex;
          const isLast = i === PIPELINE.length - 1;
          return (
            <li key={s} className="flex flex-1 items-start last:flex-none">
              <div className="flex min-w-0 flex-col items-center">
                <span
                  className={`relative flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold transition ${
                    isPast
                      ? "bg-emerald-500 text-white"
                      : isCurrent
                        ? `${meta.cls.dot} text-white shadow-md`
                        : "border-2 border-dashed border-border bg-card text-muted-fg/60"
                  }`}
                  aria-current={isCurrent ? "step" : undefined}
                >
                  {isCancelled && i === 0 ? (
                    <Slash className="h-3.5 w-3.5" />
                  ) : isPast ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    i + 1
                  )}
                  {isCurrent && (
                    <span
                      aria-hidden
                      className="absolute inset-0 -m-1 rounded-full opacity-30 animate-ping"
                      style={{ background: meta.hex }}
                    />
                  )}
                </span>
                <span
                  className={`mt-2 max-w-[88px] truncate text-center text-[10px] sm:text-[11px] ${
                    isCurrent
                      ? `font-semibold ${meta.cls.text}`
                      : isPast
                        ? "text-fg/70"
                        : "text-muted-fg"
                  }`}
                  title={meta.label}
                >
                  {meta.shortLabel}
                </span>
              </div>
              {!isLast && (
                <div className="mt-3 h-0.5 flex-1 overflow-hidden rounded-full bg-border">
                  {(isPast || (isCurrent && i + 1 <= currentIndex)) && (
                    <div className="h-full w-full bg-emerald-500/70" />
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
