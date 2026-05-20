"use client";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { addDays, format } from "date-fns";
import { ru } from "date-fns/locale";
import Link from "next/link";

interface ReqLite {
  id: string;
  number: number;
  clientName: string;
  serviceName: string;
  address: string;
  scheduledAt: string;
  duration: number;
  status: string;
  masterId: string | null;
}
interface MasterLite { id: string | null; name: string; color: string | null }

const statusColor: Record<string, string> = {
  NEW: "border-amber-500 bg-amber-500/10",
  SCHEDULED: "border-primary bg-primary/10",
  IN_PROGRESS: "border-sky-500 bg-sky-500/10",
  DONE: "border-emerald-500 bg-emerald-500/10",
  AWAITING_PAYMENT: "border-orange-500 bg-orange-500/10",
};

export function CalendarBoard({ days, masters, requests, anchor }: { days: string[]; masters: MasterLite[]; requests: ReqLite[]; anchor: string }) {
  const router = useRouter();
  const anchorDate = new Date(anchor);

  function go(delta: number) {
    const next = addDays(anchorDate, delta);
    router.push(`/crm/calendar?from=${next.toISOString().slice(0, 10)}`);
  }

  async function onDrop(e: React.DragEvent, masterId: string | null, dayIso: string) {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/req-id");
    if (!id) return;
    const day = new Date(dayIso);
    const dragged = requests.find((r) => r.id === id);
    if (!dragged) return;
    const old = new Date(dragged.scheduledAt);
    const newDate = new Date(day);
    newDate.setHours(old.getHours(), old.getMinutes(), 0, 0);
    await fetch("/api/requests", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, scheduledAt: newDate.toISOString(), assignedToId: masterId }),
    });
    router.refresh();
  }

  const rows: MasterLite[] = [{ id: null, name: "Не назначены", color: null }, ...masters];

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <button onClick={() => go(-7)} className="btn-ghost p-2"><ChevronLeft className="h-4 w-4" /></button>
          <button onClick={() => router.push("/crm/calendar")} className="btn-outline gap-2"><Calendar className="h-4 w-4" /> Эта неделя</button>
          <button onClick={() => go(7)} className="btn-ghost p-2"><ChevronRight className="h-4 w-4" /></button>
        </div>
        <div className="text-sm text-muted-fg">{format(new Date(days[0]), "d MMM", { locale: ru })} – {format(new Date(days[6]), "d MMM yyyy", { locale: ru })}</div>
      </div>

      <div className="overflow-auto">
        <div className="min-w-[1100px] grid" style={{ gridTemplateColumns: `180px repeat(7, 1fr)` }}>
          <div className="bg-muted/30 border-b border-r px-3 py-2 text-xs uppercase tracking-wider text-muted-fg">Мастер</div>
          {days.map((d) => (
            <div key={d} className="bg-muted/30 border-b border-r last:border-r-0 px-3 py-2 text-xs">
              <div className="uppercase tracking-wider text-muted-fg">{format(new Date(d), "EEEE", { locale: ru })}</div>
              <div className="font-medium">{format(new Date(d), "d MMMM", { locale: ru })}</div>
            </div>
          ))}

          {rows.map((m) => (
            <div className="contents" key={m.id || "unassigned"}>
              <div className="border-b border-r px-3 py-3 text-sm font-medium flex items-center gap-2">
                {m.color && <span className="h-2 w-2 rounded-full" style={{ background: m.color }} />}
                {m.name}
              </div>
              {days.map((d) => {
                const day = new Date(d);
                const cellRequests = requests.filter((r) => {
                  const dt = new Date(r.scheduledAt);
                  return dt.toDateString() === day.toDateString() && (r.masterId || null) === (m.id || null);
                });
                return (
                  <div
                    key={d + (m.id || "n")}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => onDrop(e, m.id, d)}
                    className="border-b border-r last:border-r-0 p-2 min-h-[110px] space-y-2 bg-bg/40 hover:bg-muted/20"
                  >
                    {cellRequests.map((r) => (
                      <Link
                        key={r.id}
                        href={`/crm/requests/${r.id}`}
                        draggable
                        onDragStart={(e) => e.dataTransfer.setData("text/req-id", r.id)}
                        className={`block rounded-lg border-l-4 ${statusColor[r.status] || "border-muted bg-muted/20"} px-2 py-1.5 text-xs cursor-grab active:cursor-grabbing`}
                      >
                        <div className="font-medium truncate">{format(new Date(r.scheduledAt), "HH:mm")} · {r.clientName}</div>
                        <div className="text-muted-fg truncate">{r.serviceName}</div>
                      </Link>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
