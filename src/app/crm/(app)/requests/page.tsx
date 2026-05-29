import Link from "next/link";
import { subDays } from "date-fns";
import { Phone, MapPin, Clock, UserRound, Inbox as InboxIcon, ChevronRight, LayoutGrid, List } from "lucide-react";
import { prisma } from "@/lib/db";
import { formatRub } from "@/lib/utils";
import { shortenSpbAddress } from "@/lib/address";
import { StatusBadge } from "@/components/crm/StatusBadge";
import { QuickActionButton } from "@/components/crm/QuickActionButton";
import { EmptyState } from "@/components/crm/EmptyState";
import { RequestDrawer } from "@/components/crm/RequestDrawer";
import { RequestsBoard } from "@/components/crm/RequestsBoard";

export const dynamic = "force-dynamic";

const filters = [
  { id: "attention", label: "Требуют внимания" },
  { id: "new", label: "Новые" },
  { id: "queue", label: "В очереди" },
  { id: "assigned", label: "Назначены" },
  { id: "active", label: "В работе" },
  { id: "payment", label: "К оплате" },
  { id: "done", label: "Завершённые" },
  { id: "all", label: "Все" },
];

type RequestsSearchParams = { queue?: string; status?: string; open?: string; view?: string };

export default async function RequestsPage({ searchParams }: { searchParams: Promise<RequestsSearchParams> }) {
  const { queue, status, open, view } = await searchParams;
  const activeFilter = status ? "all" : normalizeQueue(queue);
  const where = status ? { status } : whereForQueue(activeFilter);
  // Канбан-режим. На мобайле всегда показываем карточки — узкие колонки
  // бессмысленны, board виден только на md+.
  const isBoardView = view === "board";

  // Drawer-режим: если в URL `?open=<id>`, грузим заявку и справа рендерим
  // полную форму редактирования. Список остаётся виден слева.
  const openRequest = open
    ? await prisma.request.findUnique({
        where: { id: open },
        include: {
          client: { include: { addresses: true, printers: true, channels: true } },
          address: true,
          assignedTo: true,
          service: true,
        },
      })
    : null;

  const [services, masters] = openRequest
    ? await Promise.all([
        prisma.service.findMany({ orderBy: { name: "asc" } }),
        prisma.user.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
      ])
    : [[], []];

  const requests = await prisma.request.findMany({
    where,
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    include: { client: true, assignedTo: true, service: true, address: true },
    take: activeFilter === "all" ? 250 : 120,
  });

  // Базовый querystring текущего фильтра + view (без `open`) — для close-href
  // drawer'а и для ссылок на строки списка.
  const baseParts: string[] = [];
  if (activeFilter !== "attention") baseParts.push(`queue=${activeFilter}`);
  if (isBoardView) baseParts.push("view=board");
  const baseQuery = baseParts.length ? `?${baseParts.join("&")}` : "";
  const closeHref = `/crm/requests${baseQuery}`;
  const rowHref = (id: string) => `${closeHref}${baseQuery ? "&" : "?"}open=${id}`;
  // Ссылки переключателя представлений сохраняют queue, сбрасывают `open`.
  const tableHref = activeFilter === "attention" ? "/crm/requests" : `/crm/requests?queue=${activeFilter}`;
  const boardHref = activeFilter === "attention" ? "/crm/requests?view=board" : `/crm/requests?queue=${activeFilter}&view=board`;

  return (
    <div className={`mx-auto max-w-[1280px] space-y-4 lg:space-y-5 ${openRequest ? "lg:pr-[540px]" : ""}`}>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Заявки</h1>
          <p className="mt-1 hidden text-sm text-muted-fg md:block">
            Рабочая очередь сервиса: от новой заявки до оплаты и закрытия.
          </p>
        </div>
        <div className="hidden items-center gap-2 md:flex">
          {/* Переключатель Таблица / Доска. На мобайле скрыт — там карточки. */}
          <div className="inline-flex items-center rounded-full border border-border bg-card p-0.5 text-sm">
            <Link
              href={tableHref}
              className={`inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 transition ${
                !isBoardView ? "bg-primary text-primary-fg shadow-sm" : "text-muted-fg hover:text-fg"
              }`}
            >
              <List className="h-4 w-4" /> Таблица
            </Link>
            <Link
              href={boardHref}
              className={`inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 transition ${
                isBoardView ? "bg-primary text-primary-fg shadow-sm" : "text-muted-fg hover:text-fg"
              }`}
            >
              <LayoutGrid className="h-4 w-4" /> Доска
            </Link>
          </div>
          <Link href="/crm" className="btn-outline h-10 px-4">Рабочий стол</Link>
        </div>
      </header>

      {/* Sticky-фильтры: чтобы при длинном списке быстро переключаться без
          скролла к верху. top-14 = высота header'а в CRM-layout. */}
      <div className="sticky top-14 z-10 -mx-4 overflow-x-auto bg-bg/85 px-4 py-2 backdrop-blur-md md:mx-0 md:rounded-2xl md:px-2 md:py-1.5 [&::-webkit-scrollbar]:hidden">
        <div className="flex w-max gap-2">
          {filters.map((filter) => {
            const href = `/crm/requests${filter.id === "attention" ? "" : `?queue=${filter.id}`}`;
            const isActive = activeFilter === filter.id;
            return (
              <Link
                key={filter.id}
                href={href}
                className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition ${
                  isActive
                    ? "border-primary bg-primary text-primary-fg shadow-sm"
                    : "border-border bg-card text-muted-fg hover:bg-muted hover:text-fg"
                }`}
              >
                {filter.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Мобайл: карточки → отдельная страница (drawer на узких экранах
          даёт хуже UX, чем нативный переход с back-кнопкой). */}
      <div className="space-y-2.5 md:hidden">
        {requests.map((request) => <RequestCard key={request.id} request={request} />)}
        {requests.length === 0 && <Empty />}
      </div>

      {/* Десктоп, режим «Доска»: канбан по статусам с drag-and-drop. */}
      {isBoardView && (
        <div className="hidden md:block">
          <RequestsBoard
            requests={requests.map((r) => ({
              id: r.id,
              number: r.number,
              status: r.status,
              price: r.price,
              paymentStatus: r.paymentStatus,
              scheduledAt: r.scheduledAt ? r.scheduledAt.toISOString() : null,
              client: { name: r.client.name, phone: r.client.phone },
              service: r.service ? { name: r.service.name } : null,
              assignedTo: r.assignedTo ? { name: r.assignedTo.name } : null,
              address: r.address ? { address: r.address.address, district: r.address.district } : null,
            }))}
            rowHrefFor={rowHref}
          />
        </div>
      )}

      {/* Десктоп, режим «Таблица»: плотная SSR-таблица + drawer. */}
      <div className={`overflow-hidden rounded-2xl border border-border bg-card shadow-sm ${isBoardView ? "hidden" : "hidden md:block"}`}>
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/20 text-xs uppercase tracking-wider text-muted-fg">
            <tr>
              <th className="px-4 py-3 text-left">Заявка</th>
              <th className="px-4 py-3 text-left">Клиент</th>
              <th className="px-4 py-3 text-left">Адрес</th>
              <th className="px-4 py-3 text-left">Мастер</th>
              <th className="px-4 py-3 text-left">Статус</th>
              <th className="px-4 py-3 text-right">Оплата</th>
              <th className="px-4 py-3 text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {requests.map((request) => {
              const isOpen = openRequest?.id === request.id;
              return (
                <tr
                  key={request.id}
                  className={`group cursor-pointer transition-colors ${
                    isOpen
                      ? "bg-primary/[0.08] ring-1 ring-inset ring-primary/30"
                      : "hover:bg-primary/[0.04]"
                  }`}
                >
                  <td className="px-4 py-3">
                    <Link href={rowHref(request.id)} scroll={false} className="block font-medium transition group-hover:text-primary">
                      #{request.number} · {request.service?.name || "Без услуги"}
                    </Link>
                    <div className="text-xs text-muted-fg">
                      {request.scheduledAt
                        ? request.scheduledAt.toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
                        : "без времени"}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={rowHref(request.id)} scroll={false} className="block">
                      <div className="font-medium">{request.client.name}</div>
                    </Link>
                    <a href={`tel:${request.client.phone}`} className="text-xs text-muted-fg hover:text-fg">{request.client.phone}</a>
                  </td>
                  <td className="max-w-[260px] px-4 py-3 text-muted-fg">
                    <Link href={rowHref(request.id)} scroll={false} className="block">
                      <div className="truncate">{shortenSpbAddress(request.address?.address) || "адрес не указан"}</div>
                      {request.address?.district && <div className="text-xs">{request.address.district}</div>}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={rowHref(request.id)} scroll={false} className="block">
                      {request.assignedTo?.name || <span className="text-muted-fg">не назначен</span>}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={rowHref(request.id)} scroll={false} className="block"><StatusBadge status={request.status} size="sm" /></Link>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={rowHref(request.id)} scroll={false} className="block">
                      <div className="font-medium tabular-nums">{formatRub(request.price)}</div>
                      <div className="text-xs text-muted-fg">{paymentLabel(request.paymentStatus)}</div>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <QuickActionButton requestId={request.id} status={request.status} size="sm" showCancel={request.status === "NEW"} />
                  </td>
                </tr>
              );
            })}
            {requests.length === 0 && (
              <tr><td colSpan={7}><Empty /></td></tr>
            )}
          </tbody>
        </table>
      </div>

      {openRequest && (
        <RequestDrawer
          request={openRequest}
          services={services}
          masters={masters}
          closeHref={closeHref}
        />
      )}
    </div>
  );
}

function RequestCard({ request }: { request: any }) {
  const scheduled = request.scheduledAt
    ? request.scheduledAt.toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
    : "без времени";
  const address = shortenSpbAddress(request.address?.address);

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition active:scale-[0.99]">
      <Link
        href={`/crm/requests/${request.id}`}
        className="block px-4 py-4 active:bg-muted/40"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-muted-fg">#{request.number}</span>
              <StatusBadge status={request.status} size="sm" />
            </div>
            <div className="mt-1 truncate text-base font-semibold">{request.client.name}</div>
            <div className="truncate text-sm text-muted-fg">{request.service?.name || "Услуга не указана"}</div>
          </div>
          <div className="shrink-0 text-right">
            <div className="font-semibold tabular-nums">{formatRub(request.price)}</div>
            <div className="text-[11px] text-muted-fg">{paymentLabel(request.paymentStatus)}</div>
            <ChevronRight className="ml-auto mt-1 h-4 w-4 text-muted-fg/60" />
          </div>
        </div>

        <div className="mt-3 grid gap-1 text-sm">
          {address && (
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#DC2626]" />
              <span className="truncate text-fg/85">{address}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-muted-fg">
            <Clock className="h-3.5 w-3.5" />
            <span>{scheduled}</span>
            {request.assignedTo?.name && (
              <>
                <span aria-hidden>·</span>
                <UserRound className="h-3.5 w-3.5" />
                <span className="truncate">{request.assignedTo.name}</span>
              </>
            )}
          </div>
        </div>
      </Link>

      <div className="flex items-center justify-between gap-2 border-t border-border bg-bg-2/40 px-3 py-2">
        <a
          href={`tel:${request.client.phone}`}
          className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-fg active:bg-muted/40"
          aria-label="Позвонить"
        >
          <Phone className="h-3.5 w-3.5 text-[#2563EB]" /> {request.client.phone}
        </a>
        <QuickActionButton requestId={request.id} status={request.status} size="sm" showCancel={false} />
      </div>
    </article>
  );
}

function Empty() {
  return (
    <EmptyState
      icon={InboxIcon}
      tone="blue"
      title="Заявок в этой очереди нет"
      hint="Когда заявка попадёт под выбранный фильтр, она появится здесь."
    />
  );
}

function normalizeQueue(queue?: string) {
  return filters.some((filter) => filter.id === queue) ? queue! : "attention";
}

function whereForQueue(queue: string) {
  const staleFrom = subDays(new Date(), 2);
  if (queue === "new") return { status: "NEW" };
  if (queue === "queue") return { scheduledAt: null, status: { in: ["NEW", "ACCEPTED"] } };
  if (queue === "assigned") return { assignedToId: { not: null }, status: { in: ["ACCEPTED", "SCHEDULED"] } };
  if (queue === "active") return { status: { in: ["EN_ROUTE", "ON_SITE", "IN_PROGRESS"] } };
  if (queue === "payment") return { OR: [{ status: "AWAITING_PAYMENT" }, { paymentStatus: { not: "PAID" }, price: { gt: 0 } }] };
  if (queue === "done") return { status: "DONE" };
  if (queue === "all") return {};
  return {
    OR: [
      { status: "NEW" },
      { status: { in: ["NEW", "ACCEPTED", "SCHEDULED"] }, OR: [{ addressId: null }, { serviceId: null }] },
      { status: { in: ["EN_ROUTE", "ON_SITE", "IN_PROGRESS"] } },
      { status: "AWAITING_PAYMENT" },
      { status: { notIn: ["DONE", "CANCELLED"] }, createdAt: { lt: staleFrom } },
    ],
  };
}

function paymentLabel(status: string) {
  if (status === "PAID") return "оплачено";
  if (status === "PARTIAL") return "частично";
  return "не оплачено";
}
