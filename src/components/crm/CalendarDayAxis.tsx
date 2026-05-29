"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useMemo } from "react";
import { format, parseISO } from "date-fns";
import { Clock, MapPin, AlertTriangle } from "lucide-react";

/**
 * Временная шкала дня: вертикальная ось 9:00–20:00. Каждый час = HOUR_PX.
 *
 * Зачем: в плоском списке выездов невозможно с одного взгляда увидеть,
 * где у тебя «дыра» между визитами, а где плотно. Шкала визуально
 * показывает занятость суток.
 *
 *   • Визиты — абсолютно позиционированные блоки на оси
 *   • Клик в пустую часть оси → создать заявку на это время (printcare:quickadd)
 *   • Перекрывающиеся визиты подсвечиваются красной рамкой как конфликт
 *   • Если день — сегодня, отображается красная линия «сейчас»
 *
 * Drag-перенос и drag-resize — следующие шаги, здесь только просмотр+создание.
 */

type Trip = {
  id: string;
  number: number;
  clientName: string;
  serviceName: string;
  address: string;
  district?: string | null;
  scheduledAt: string;
  duration: number;
  status: string;
  masterName?: string | null;
};

const START_HOUR = 9;
const END_HOUR = 21;
const HOURS = END_HOUR - START_HOUR;
const HOUR_PX = 72;
const TOTAL_PX = HOURS * HOUR_PX;

export function CalendarDayAxis({
  dayKey,
  todayKey,
  requests,
}: {
  dayKey: string;
  todayKey: string;
  requests: Trip[];
}) {
  const router = useRouter();
  const railRef = useRef<HTMLDivElement>(null);
  const [nowOffset, setNowOffset] = useState<number | null>(null);

  // Drag-state: id двигаемого визита, offset курсора внутри блока (px) и
  // текущая предложенная позиция (минут от START_HOUR) — для подсветки.
  const [dragId, setDragId] = useState<string | null>(null);
  const dragGrabOffsetRef = useRef<number>(0);
  const [dragMin, setDragMin] = useState<number | null>(null);

  // Оптимистичный оверрайд: пока запрос на сервер не вернулся, локально
  // показываем новое время. Сбрасываем после router.refresh().
  const [pendingMove, setPendingMove] = useState<Map<string, string>>(new Map());

  // Применяем pendingMove к исходным requests, чтобы визуально блок уже стоял
  // в новой позиции.
  const effectiveRequests = useMemo(
    () => requests.map((r) => pendingMove.has(r.id) ? { ...r, scheduledAt: pendingMove.get(r.id)! } : r),
    [requests, pendingMove],
  );

  // Линия «сейчас» — только если этот день сегодня. Обновляем раз в минуту.
  useEffect(() => {
    if (dayKey !== todayKey) {
      setNowOffset(null);
      return;
    }
    function tick() {
      const now = new Date();
      const hours = now.getHours() + now.getMinutes() / 60;
      if (hours < START_HOUR || hours > END_HOUR) {
        setNowOffset(null);
        return;
      }
      setNowOffset((hours - START_HOUR) * HOUR_PX);
    }
    tick();
    const t = setInterval(tick, 60_000);
    return () => clearInterval(t);
  }, [dayKey, todayKey]);

  const placed = layoutOverlaps(effectiveRequests);

  function yToMin(y: number, snap = 15): number {
    const m = Math.round((y / HOUR_PX) * 60 / snap) * snap;
    return Math.max(0, Math.min(HOURS * 60 - snap, m));
  }

  function minToIso(min: number): string {
    const h = Math.floor(min / 60) + START_HOUR;
    const m = min % 60;
    return `${dayKey}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
  }

  function handleRailClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!railRef.current) return;
    const target = e.target as HTMLElement;
    if (target.closest("[data-trip-block]")) return;
    const rect = railRef.current.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const min = yToMin(y, 30);
    window.dispatchEvent(new CustomEvent("printcare:quickadd", { detail: { scheduledAt: minToIso(min) } }));
  }

  // ── Drag handlers на уровне рельса ──
  // Используем onDragOver чтобы апдейтить превью, onDrop — фиксируем.
  function handleRailDragOver(e: React.DragEvent<HTMLDivElement>) {
    if (!dragId || !railRef.current) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const rect = railRef.current.getBoundingClientRect();
    const y = e.clientY - rect.top - dragGrabOffsetRef.current;
    setDragMin(yToMin(y, 15));
  }

  async function handleRailDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const id = dragId;
    const min = dragMin;
    setDragId(null);
    setDragMin(null);
    if (!id || min == null) return;
    const newIso = minToIso(min);
    // Оптимистично двигаем блок
    setPendingMove((prev) => {
      const next = new Map(prev);
      next.set(id, newIso);
      return next;
    });
    try {
      const res = await fetch("/api/requests", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, scheduledAt: newIso }),
      });
      if (!res.ok) throw new Error("patch failed");
      router.refresh();
      // pendingMove очищаем чуть позже — даём время серверным props приехать
      setTimeout(() => {
        setPendingMove((prev) => {
          const next = new Map(prev);
          next.delete(id);
          return next;
        });
      }, 300);
    } catch {
      // откат
      setPendingMove((prev) => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
    }
  }

  function beginDrag(tripId: string, grabOffsetWithinBlock: number) {
    setDragId(tripId);
    dragGrabOffsetRef.current = grabOffsetWithinBlock;
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card/45">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="font-semibold">Шкала дня</h2>
        <div className="text-xs text-muted-fg">
          Клик в свободное место — создать заявку
        </div>
      </div>

      <div className="relative flex">
        {/* Левая колонка с часами */}
        <div className="w-14 shrink-0 border-r border-border bg-bg-2/30">
          {Array.from({ length: HOURS + 1 }).map((_, i) => (
            <div
              key={i}
              className="flex items-start justify-end pr-2 pt-0 text-[11px] tabular-nums text-muted-fg"
              style={{ height: i === HOURS ? 0 : HOUR_PX, transform: "translateY(-7px)" }}
            >
              {String(START_HOUR + i).padStart(2, "0")}:00
            </div>
          ))}
        </div>

        {/* Сама шкала + блоки */}
        <div
          ref={railRef}
          onClick={handleRailClick}
          onDragOver={handleRailDragOver}
          onDrop={handleRailDrop}
          className={`relative flex-1 ${dragId ? "cursor-grabbing" : "cursor-crosshair"}`}
          style={{ height: TOTAL_PX }}
        >
          {/* Часовые и получасовые линии */}
          {Array.from({ length: HOURS + 1 }).map((_, i) => (
            <div
              key={i}
              className="absolute left-0 right-0 border-t border-border/80"
              style={{ top: i * HOUR_PX }}
            />
          ))}
          {Array.from({ length: HOURS }).map((_, i) => (
            <div
              key={`half-${i}`}
              className="absolute left-0 right-0 border-t border-dashed border-border/40"
              style={{ top: i * HOUR_PX + HOUR_PX / 2 }}
            />
          ))}

          {/* «Сейчас» */}
          {nowOffset != null && (
            <div
              className="absolute left-0 right-0 z-20 pointer-events-none"
              style={{ top: nowOffset }}
            >
              <div className="relative h-px bg-red-500/80">
                <div className="absolute -left-1.5 -top-1.5 h-3 w-3 rounded-full bg-red-500 shadow" />
              </div>
            </div>
          )}

          {/* Превью новой позиции при drag */}
          {dragId && dragMin != null && (() => {
            const dragged = placed.find((p) => p.trip.id === dragId);
            const previewHeight = dragged?.height ?? (60 / 60) * HOUR_PX;
            const top = (dragMin / 60) * HOUR_PX;
            return (
              <div
                className="pointer-events-none absolute z-30 rounded-lg border-2 border-dashed border-primary bg-primary/15 px-2.5 py-1"
                style={{ top, left: 4, right: 4, height: previewHeight }}
              >
                <div className="font-mono text-[10px] text-primary">
                  {String(Math.floor(dragMin / 60) + START_HOUR).padStart(2, "0")}:
                  {String(dragMin % 60).padStart(2, "0")} ← перенести сюда
                </div>
              </div>
            );
          })()}

          {/* Блоки визитов */}
          {placed.map((p) => (
            <TripBlock
              key={p.trip.id}
              placement={p}
              isDragging={dragId === p.trip.id}
              onBeginDrag={(grabOffset) => beginDrag(p.trip.id, grabOffset)}
              onCancelDrag={() => { setDragId(null); setDragMin(null); }}
            />
          ))}

          {/* Hint поверх пустой шкалы, если совсем ничего нет */}
          {requests.length === 0 && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-muted-fg">
              На день ничего не поставлено.<br />Клик в час — создать заявку.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── вёрстка блока визита ─────────────────────────────────────────── */

function TripBlock({
  placement,
  isDragging,
  onBeginDrag,
  onCancelDrag,
}: {
  placement: Placement;
  isDragging: boolean;
  onBeginDrag: (grabOffsetWithinBlock: number) => void;
  onCancelDrag: () => void;
}) {
  const { trip, top, height, col, cols, hasConflict } = placement;
  const start = parseISO(trip.scheduledAt);
  const widthPct = 100 / cols;
  const leftPct = col * widthPct;

  // Если drag был, подавляем последующий click (Link), чтобы не перейти
  // в карточку при простом перетаскивании.
  const draggedRef = useRef(false);

  return (
    <Link
      data-trip-block
      href={`/crm/requests/${trip.id}`}
      draggable
      onDragStart={(e) => {
        draggedRef.current = true;
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const offsetWithin = e.clientY - rect.top;
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", trip.id);
        onBeginDrag(offsetWithin);
      }}
      onDragEnd={() => {
        onCancelDrag();
        // Сбрасываем флаг чуть позже, чтобы click после drag не сработал
        setTimeout(() => { draggedRef.current = false; }, 0);
      }}
      className={`absolute z-10 overflow-hidden rounded-lg border px-2.5 py-1.5 text-xs shadow-sm transition cursor-grab active:cursor-grabbing hover:shadow-md ${
        isDragging ? "opacity-40" : ""
      } ${
        hasConflict
          ? "border-red-500/60 bg-red-50 hover:border-red-500"
          : statusToTone(trip.status)
      }`}
      style={{
        top,
        height: Math.max(height, 28),
        left: `calc(${leftPct}% + 4px)`,
        width: `calc(${widthPct}% - 8px)`,
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (draggedRef.current) {
          e.preventDefault();
        }
      }}
    >
      <div className="flex items-center justify-between gap-1 font-mono text-[10px] text-fg/70">
        <span className="inline-flex items-center gap-1">
          <Clock className="h-2.5 w-2.5" />
          {format(start, "HH:mm")}
        </span>
        {hasConflict && (
          <span className="inline-flex items-center gap-0.5 rounded bg-red-500 px-1 py-0.5 text-[9px] font-semibold text-white">
            <AlertTriangle className="h-2.5 w-2.5" />
            пересечение
          </span>
        )}
      </div>
      <div className="mt-0.5 truncate font-semibold text-fg">
        #{trip.number} · {trip.clientName}
      </div>
      <div className="truncate text-[11px] text-fg/70">{trip.serviceName}</div>
      {height >= 56 && trip.address && (
        <div className="mt-0.5 flex items-center gap-1 truncate text-[10px] text-fg/60">
          <MapPin className="h-2.5 w-2.5 shrink-0" />
          <span className="truncate">{trip.district || trip.address}</span>
        </div>
      )}
    </Link>
  );
}

/* ─── вычисляем кластеры пересечений и колонку для каждого ───────── */

type Placement = {
  trip: Trip;
  top: number;
  height: number;
  col: number;
  cols: number;
  hasConflict: boolean;
};

function layoutOverlaps(trips: Trip[]): Placement[] {
  if (trips.length === 0) return [];

  // Сортируем по времени старта, переводим в минуты от START_HOUR
  const items = trips
    .map((t) => {
      const d = parseISO(t.scheduledAt);
      const startMin = d.getHours() * 60 + d.getMinutes() - START_HOUR * 60;
      const duration = Math.max(30, t.duration || 60); // минимум 30 мин для видимости
      return { trip: t, startMin, endMin: startMin + duration };
    })
    .filter((it) => it.endMin > 0 && it.startMin < HOURS * 60)
    .sort((a, b) => a.startMin - b.startMin);

  // Простой алгоритм укладки: для каждого визита берём первую колонку,
  // которая в этот интервал не занята. Кластер пересечений — connected component
  // по пересечениям. Считаем максимальную ширину кластера для нормировки cols.
  type Slot = { item: typeof items[number]; col: number };
  const slots: Slot[] = [];
  // Для каждого визита определяем col как min(col), который ещё не «висит» сейчас.
  const active: Slot[] = [];
  for (const item of items) {
    // Освобождаем колонки, которые уже закончились до начала этого
    for (let i = active.length - 1; i >= 0; i--) {
      if (active[i].item.endMin <= item.startMin) active.splice(i, 1);
    }
    const usedCols = new Set(active.map((s) => s.col));
    let col = 0;
    while (usedCols.has(col)) col++;
    const slot: Slot = { item, col };
    slots.push(slot);
    active.push(slot);
  }

  // Группируем в кластеры пересечений, чтобы у каждого был верный `cols`
  const clusters: Slot[][] = [];
  const visited = new Set<Slot>();
  for (const s of slots) {
    if (visited.has(s)) continue;
    const cluster: Slot[] = [s];
    visited.add(s);
    // расширяем кластер всеми, кто пересекается с уже найденными
    let added = true;
    while (added) {
      added = false;
      for (const candidate of slots) {
        if (visited.has(candidate)) continue;
        if (cluster.some((c) => intersects(c.item, candidate.item))) {
          cluster.push(candidate);
          visited.add(candidate);
          added = true;
        }
      }
    }
    clusters.push(cluster);
  }

  const placements: Placement[] = [];
  for (const cluster of clusters) {
    const cols = Math.max(...cluster.map((s) => s.col)) + 1;
    const hasConflict = cluster.length > 1;
    for (const s of cluster) {
      const top = (s.item.startMin / 60) * HOUR_PX;
      const height = ((s.item.endMin - s.item.startMin) / 60) * HOUR_PX - 4;
      placements.push({
        trip: s.item.trip,
        top: Math.max(0, top),
        height: Math.max(24, height),
        col: s.col,
        cols,
        hasConflict,
      });
    }
  }
  return placements;
}

function intersects(a: { startMin: number; endMin: number }, b: { startMin: number; endMin: number }) {
  return a.startMin < b.endMin && b.startMin < a.endMin;
}

function statusToTone(status: string): string {
  switch (status) {
    case "NEW":
      return "border-blue-300/70 bg-blue-50 hover:border-blue-400";
    case "ACCEPTED":
    case "SCHEDULED":
      return "border-indigo-300/70 bg-indigo-50 hover:border-indigo-400";
    case "EN_ROUTE":
    case "ON_SITE":
    case "IN_PROGRESS":
      return "border-orange-300/70 bg-orange-50 hover:border-orange-400";
    case "AWAITING_PAYMENT":
      return "border-amber-300/70 bg-amber-50 hover:border-amber-400";
    case "DONE":
      return "border-emerald-300/70 bg-emerald-50 hover:border-emerald-400";
    default:
      return "border-border bg-card";
  }
}
