"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, X } from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import { StatusPipeline } from "./StatusPipeline";
import { QuickActionButton } from "./QuickActionButton";
import { RequestEditor } from "./RequestEditor";

/**
 * Right-side drawer для просмотра/редактирования заявки на странице
 * `/crm/requests?open=<id>`. Список заявок остаётся видим слева — это
 * убирает дорогой паттерн «открыть → вернуться → найти строку → открыть
 * следующую», который был в SSR-таблице.
 *
 * Закрытие — Esc или клик по «крестику»; оба действия меняют URL,
 * убирая `?open` и сохраняя текущий фильтр.
 */
export function RequestDrawer({
  request,
  services,
  masters,
  closeHref,
}: {
  request: any;
  services: any[];
  masters: any[];
  closeHref: string;
}) {
  const router = useRouter();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        router.push(closeHref, { scroll: false });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, closeHref]);

  return (
    <aside
      role="complementary"
      aria-label={`Заявка #${request.number}`}
      // fixed справа от шапки до низа viewport. shadow-2xl делит панель
      // от списка визуально. На <lg перекроет всю ширину — на этих
      // экранах drawer не вызывается, нажатия идут на /crm/requests/[id].
      className="fixed right-0 top-14 bottom-0 z-20 hidden w-[520px] flex-col overflow-hidden border-l border-border bg-card shadow-2xl shadow-slate-900/15 lg:flex"
    >
      <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <span className="text-base font-semibold">Заявка #{request.number}</span>
            <StatusBadge status={request.status} size="sm" />
          </div>
          <div className="mt-0.5 truncate text-xs text-muted-fg">
            {request.client?.name} · {request.service?.name || "Без услуги"}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Link
            href={`/crm/requests/${request.id}`}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-bg-2/60 px-3 text-xs font-medium text-muted-fg transition hover:border-primary/40 hover:text-fg"
            title="Открыть как отдельную страницу"
          >
            <ArrowUpRight className="h-3.5 w-3.5" />
            <span>Открыть</span>
          </Link>
          <Link
            href={closeHref}
            scroll={false}
            aria-label="Закрыть"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-fg transition hover:bg-muted/40 hover:text-fg"
          >
            <X className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <StatusPipeline status={request.status} />
        </div>
        <QuickActionButton
          requestId={request.id}
          status={request.status}
          size="md"
          showCancel={request.status !== "CANCELLED" && request.status !== "DONE"}
        />
        <RequestEditor request={request} services={services} masters={masters} />
      </div>
    </aside>
  );
}
