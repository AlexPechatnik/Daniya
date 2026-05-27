"use client";

import { Check } from "lucide-react";
import { PIPELINE, PIPELINE_INDEX, STATUS_META, statusMeta } from "@/lib/status";

/**
 * Компактная версия pipeline для мобайла:
 * показывает только 3 этапа — предыдущий, текущий, следующий.
 * Этого достаточно, чтобы понять «откуда — где — куда», без сжатия 7 точек.
 *
 *   ✓ Принята  ─ ●(сейчас) В пути  ─ ○ На месте
 */
export function MobileStatusPipeline({ status }: { status: string }) {
  if (status === "CANCELLED") {
    const m = statusMeta("CANCELLED");
    return (
      <div className={`rounded-xl border ${m.cls.border} ${m.cls.bg} px-3 py-2 text-xs font-medium ${m.cls.text}`}>
        Заявка отменена
      </div>
    );
  }
  const idx = PIPELINE_INDEX[status] ?? 0;
  const prev = idx > 0 ? PIPELINE[idx - 1] : null;
  const curr = PIPELINE[idx];
  const next = idx < PIPELINE.length - 1 ? PIPELINE[idx + 1] : null;
  const currMeta = STATUS_META[curr];

  return (
    <div className="flex items-center gap-1.5">
      {prev && <Step status={prev} state="past" />}
      {prev && <Connector state="past" />}
      <Step status={curr} state="current" currColor={currMeta.hex} />
      {next && <Connector state="future" />}
      {next && <Step status={next} state="future" />}
      <span className="ml-auto text-[10px] text-muted-fg tabular-nums">
        {idx + 1} / {PIPELINE.length}
      </span>
    </div>
  );
}

function Step({
  status,
  state,
  currColor,
}: {
  status: string;
  state: "past" | "current" | "future";
  currColor?: string;
}) {
  const meta = statusMeta(status);
  const circle =
    state === "past"
      ? "bg-emerald-500 text-white"
      : state === "current"
        ? `${meta.cls.dot} text-white shadow-sm`
        : "border border-dashed border-border bg-card text-muted-fg/60";
  return (
    <div className="flex items-center gap-1.5">
      <span
        className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold ${circle}`}
        style={state === "current" && currColor ? { boxShadow: `0 0 0 3px ${currColor}22` } : undefined}
      >
        {state === "past" ? <Check className="h-3 w-3" /> : null}
      </span>
      <span
        className={`text-[11px] font-medium ${
          state === "current" ? meta.cls.text : state === "past" ? "text-fg/70" : "text-muted-fg"
        }`}
      >
        {meta.shortLabel}
      </span>
    </div>
  );
}

function Connector({ state }: { state: "past" | "future" }) {
  return (
    <span
      className={`h-px w-3 ${state === "past" ? "bg-emerald-500/60" : "bg-border"}`}
      aria-hidden
    />
  );
}
