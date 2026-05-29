"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Clock, MapPin, Phone, UserRound, GripVertical } from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import { formatRub } from "@/lib/utils";
import { shortenSpbAddress } from "@/lib/address";

/**
 * Канбан-доска заявок. Колонки сгруппированы по фазам жизненного цикла:
 *
 *   Новые → Запланированы → В работе → К оплате → Готово
 *
 * HTML5 drag-and-drop без сторонних либ — для одиночного админ-UI хватит,
 * не тащим 30кб бандла. Перетаскивание между колонками выполняет PATCH
 * /api/requests со сменой статуса и router.refresh() для обновления
 * SSR-данных. Если запрос упал — карточка возвращается на исходное место
 * (через router.refresh() — серверные данные «правда»).
 *
 * Тач-устройства HTML5 DnD не поддерживают «из коробки», но drawer всё
 * равно даёт возможность сменить статус через QuickActionButton.
 */

type RequestRow = {
  id: string;
  number: number;
  status: string;
  price: number | null;
  paymentStatus: string;
  scheduledAt: string | null;
  client: { name: string; phone: string };
  service: { name: string } | null;
  assignedTo: { name: string } | null;
  address: { address: string; district: string | null } | null;
};

// Один статус-«сегмент» = одна колонка. Карточки группируются по этому
// ключу. При drop'е используем `dropStatus` — это статус, в который
// переводим заявку (чаще всего совпадает с первым из `statuses`).
const COLUMNS: { key: string; title: string; statuses: string[]; dropStatus: string; tone: string }[] = [
  { key: "new", title: "Новые", statuses: ["NEW"], dropStatus: "NEW", tone: "from-blue-500/15 to-blue-500/5" },
  { key: "scheduled", title: "Запланированы", statuses: ["ACCEPTED", "SCHEDULED"], dropStatus: "SCHEDULED", tone: "from-indigo-500/15 to-indigo-500/5" },
  { key: "active", title: "В работе", statuses: ["EN_ROUTE", "ON_SITE", "IN_PROGRESS"], dropStatus: "IN_PROGRESS", tone: "from-orange-500/15 to-orange-500/5" },
  { key: "payment", title: "К оплате", statuses: ["AWAITING_PAYMENT"], dropStatus: "AWAITING_PAYMENT", tone: "from-amber-500/15 to-amber-500/5" },
  { key: "done", title: "Готово", statuses: ["DONE"], dropStatus: "DONE", tone: "from-emerald-500/15 to-emerald-500/5" },
];

export function RequestsBoard({
  requests,
  baseQuery,
}: {
  requests: RequestRow[];
  /** querystring текущего фильтра без `open` (например `?queue=new&view=board`). */
  baseQuery: string;
}) {
  // Серверный компонент не может передать сюда функцию (Functions cannot be
  // passed to Client Components), поэтому строим href из строки прямо здесь.
  const rowHrefFor = (id: string) =>
    `/crm/requests${baseQuery}${baseQuery ? "&" : "?"}open=${id}`;

  const router = useRouter();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  // Оптимистично скрываем «улетевшую» карточку, пока сервер не подтвердит.
  const [pendingRemove, setPendingRemove] = useState<Set<string>>(new Set());

  const grouped = COLUMNS.map((col) => ({
    ...col,
    items: requests.filter(
      (r) => col.statuses.includes(r.status) && !pendingRemove.has(r.id),
    ),
  }));

  async function moveTo(id: string, status: string) {
    setPendingRemove((prev) => new Set(prev).add(id));
    try {
      const res = await fetch("/api/requests", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) throw new Error("patch failed");
      router.refresh();
      // router.refresh() заменит SSR-данные — pendingRemove можно сбросить
      // на следующей рендер-итерации. Делаем через setTimeout, чтобы не
      // моргнуло.
      setTimeout(() => {
        setPendingRemove((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }, 300);
    } catch {
      setPendingRemove((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  return (
    <div className="-mx-4 overflow-x-auto pb-2 md:mx-0 [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border">
      <div className="flex w-max gap-3 px-4 md:px-0">
        {grouped.map((col) => {
          const isDropTarget = dropTarget === col.key;
          return (
            <section
              key={col.key}
              onDragOver={(e) => {
                if (!draggingId) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (dropTarget !== col.key) setDropTarget(col.key);
              }}
              onDragLeave={(e) => {
                // Срабатывает и при переходе на дочерний элемент — поэтому
                // проверяем, что мышка реально вне колонки.
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                  setDropTarget((prev) => (prev === col.key ? null : prev));
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/plain") || draggingId;
                if (id) {
                  const item = requests.find((r) => r.id === id);
                  // Если статус уже соответствует колонке — ничего не делаем.
                  if (item && !col.statuses.includes(item.status)) {
                    moveTo(id, col.dropStatus);
                  }
                }
                setDraggingId(null);
                setDropTarget(null);
              }}
              className={`flex w-[300px] shrink-0 flex-col rounded-2xl border bg-gradient-to-b ${col.tone} ${
                isDropTarget
                  ? "border-primary ring-2 ring-primary/30"
                  : "border-border"
              }`}
            >
              <header className="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
                <h3 className="text-sm font-semibold tracking-tight">{col.title}</h3>
                <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-card px-2 text-[11px] font-semibold tabular-nums text-muted-fg ring-1 ring-border">
                  {col.items.length}
                </span>
              </header>
              <div className="flex flex-col gap-2 p-2.5 min-h-[120px]">
                {col.items.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border/50 px-3 py-6 text-center text-xs text-muted-fg">
                    Перетащите сюда заявку
                  </div>
                ) : (
                  col.items.map((r) => (
                    <BoardCard
                      key={r.id}
                      request={r}
                      href={rowHrefFor(r.id)}
                      onDragStart={() => setDraggingId(r.id)}
                      onDragEnd={() => {
                        setDraggingId(null);
                        setDropTarget(null);
                      }}
                      dragging={draggingId === r.id}
                    />
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function BoardCard({
  request,
  href,
  onDragStart,
  onDragEnd,
  dragging,
}: {
  request: RequestRow;
  href: string;
  onDragStart: () => void;
  onDragEnd: () => void;
  dragging: boolean;
}) {
  const scheduled = request.scheduledAt
    ? new Date(request.scheduledAt).toLocaleString("ru-RU", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;
  const address = shortenSpbAddress(request.address?.address);

  return (
    <article
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", request.id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className={`group relative overflow-hidden rounded-xl border border-border bg-card shadow-sm transition ${
        dragging ? "opacity-40 scale-[0.98]" : "hover:border-primary/40 hover:shadow-md"
      }`}
    >
      <Link href={href} scroll={false} className="block px-3 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] text-muted-fg">#{request.number}</span>
              <StatusBadge status={request.status} size="sm" />
            </div>
            <div className="mt-1.5 truncate text-sm font-semibold">{request.client.name}</div>
            <div className="truncate text-xs text-muted-fg">{request.service?.name || "Услуга не выбрана"}</div>
          </div>
          <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-muted-fg/40 transition group-hover:text-muted-fg/70" />
        </div>

        <div className="mt-2.5 space-y-1 text-[11px] text-muted-fg">
          {scheduled && (
            <div className="flex items-center gap-1.5">
              <Clock className="h-3 w-3" />
              <span>{scheduled}</span>
            </div>
          )}
          {address && (
            <div className="flex items-start gap-1.5">
              <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-[#DC2626]" />
              <span className="truncate">{address}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <UserRound className="h-3 w-3" />
            <span className="truncate">{request.assignedTo?.name || "не назначен"}</span>
          </div>
        </div>

        {request.price ? (
          <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-border/50 pt-2 text-xs">
            <a
              href={`tel:${request.client.phone}`}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-muted-fg hover:text-fg"
            >
              <Phone className="h-3 w-3" />
              <span className="truncate">{request.client.phone}</span>
            </a>
            <span className="font-semibold tabular-nums">{formatRub(request.price)}</span>
          </div>
        ) : (
          <div className="mt-2.5 border-t border-border/50 pt-2 text-[11px]">
            <a
              href={`tel:${request.client.phone}`}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-muted-fg hover:text-fg"
            >
              <Phone className="h-3 w-3" />
              {request.client.phone}
            </a>
          </div>
        )}
      </Link>
    </article>
  );
}
