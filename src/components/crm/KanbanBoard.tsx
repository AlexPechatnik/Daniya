"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { PIPELINE, STATUS_META, statusMeta } from "@/lib/status";
import { formatRub } from "@/lib/utils";
import { Phone, MapPin, Clock } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

interface ReqLite {
  id: string;
  number: number;
  clientName: string;
  clientPhone: string;
  serviceName: string;
  printerInfo: string | null;
  address: string;
  scheduledAt: string | null;
  status: string;
  price: number | null;
}

const COLUMNS = ["NEW", "ACCEPTED", "SCHEDULED", "EN_ROUTE", "ON_SITE", "IN_PROGRESS", "AWAITING_PAYMENT", "DONE"] as const;

export function KanbanBoard({ requests }: { requests: ReqLite[] }) {
  const router = useRouter();
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

  async function onDrop(e: React.DragEvent, newStatus: string) {
    e.preventDefault();
    setDragOverCol(null);
    const id = e.dataTransfer.getData("text/req-id");
    const oldStatus = e.dataTransfer.getData("text/req-status");
    if (!id || oldStatus === newStatus) return;
    await fetch(`/api/requests/${id}/transition`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ to: newStatus }),
    });
    router.refresh();
  }

  return (
    <div className="overflow-x-auto -mx-4 lg:mx-0">
      <div className="inline-flex gap-3 px-4 lg:px-0 min-w-full pb-4">
        {COLUMNS.map((status) => {
          const meta = STATUS_META[status];
          const items = requests.filter((r) => r.status === status);
          const total = items.reduce((s, r) => s + (r.price || 0), 0);
          const isDragOver = dragOverCol === status;
          return (
            <div
              key={status}
              onDragOver={(e) => { e.preventDefault(); setDragOverCol(status); }}
              onDragLeave={() => setDragOverCol(null)}
              onDrop={(e) => onDrop(e, status)}
              className={`shrink-0 w-[300px] flex flex-col rounded-2xl border transition ${
                isDragOver ? `${meta.cls.border} ${meta.cls.bg} ring-2 ${meta.cls.ring}` : "border-border bg-card/30"
              }`}
            >
              <div className="px-4 py-3 border-b border-border flex items-center justify-between sticky top-0 bg-card/60 backdrop-blur rounded-t-2xl">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${meta.cls.dot}`} />
                  <div className="text-sm font-semibold">{meta.label}</div>
                  <div className="text-xs text-muted-fg tabular-nums">{items.length}</div>
                </div>
                {total > 0 && (
                  <div className="text-xs text-muted-fg tabular-nums">{formatRub(total)}</div>
                )}
              </div>
              <div className="p-2 space-y-2 flex-1 min-h-[200px]">
                {items.map((r) => (
                  <KanbanCard key={r.id} r={r} />
                ))}
                {items.length === 0 && (
                  <div className="py-10 text-center text-xs text-slate-500">пусто</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function KanbanCard({ r }: { r: ReqLite }) {
  const router = useRouter();
  const m = statusMeta(r.status);
  return (
    <div
      role="link"
      tabIndex={0}
      draggable
      onClick={() => router.push(`/crm/requests/${r.id}`)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          router.push(`/crm/requests/${r.id}`);
        }
      }}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/req-id", r.id);
        e.dataTransfer.setData("text/req-status", r.status);
      }}
      className="block rounded-xl border border-border bg-bg/60 hover:bg-bg active:cursor-grabbing cursor-grab p-3 transition shadow-sm hover:shadow-md"
      style={{ borderLeft: `3px solid ${m.hex}` }}
    >
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-[10px] text-muted-fg">#{r.number}</span>
        <span className="text-sm font-medium truncate">{r.clientName}</span>
      </div>
      <div className="mt-1 text-xs text-muted-fg truncate">
        {r.serviceName}
        {r.printerInfo && ` · ${r.printerInfo}`}
      </div>
      {r.scheduledAt && (
        <div className="mt-2 flex items-center gap-1 text-xs text-muted-fg">
          <Clock className="h-3 w-3" />
          {format(new Date(r.scheduledAt), "d MMM · HH:mm", { locale: ru })}
        </div>
      )}
      {r.address && (
        <div className="mt-1 flex items-center gap-1 text-xs text-muted-fg truncate">
          <MapPin className="h-3 w-3 shrink-0" />
          <span className="truncate">{r.address}</span>
        </div>
      )}
      <div className="mt-2 flex items-center justify-between gap-2">
        <a
          href={`tel:${r.clientPhone}`}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          className="text-xs text-muted-fg hover:text-primary inline-flex items-center gap-1"
        >
          <Phone className="h-3 w-3" /> {r.clientPhone}
        </a>
        {r.price != null && r.price > 0 && (
          <div className="text-xs tabular-nums font-medium">{formatRub(r.price)}</div>
        )}
      </div>
    </div>
  );
}
