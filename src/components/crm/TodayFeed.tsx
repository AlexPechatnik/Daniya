import Link from "next/link";
import { prisma } from "@/lib/db";
import { endOfDay, format, startOfDay, subDays } from "date-fns";
import { ru } from "date-fns/locale";
import { AlertCircle, ArrowRight, CalendarDays, Clock, CreditCard, MapPin, Phone, Route, UserRound } from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import { QuickActionButton } from "./QuickActionButton";
import { formatRub } from "@/lib/utils";
import { shortenSpbAddress } from "@/lib/address";

const ACTIVE_STATUSES = ["ACCEPTED", "SCHEDULED", "EN_ROUTE", "ON_SITE", "IN_PROGRESS"];

export async function TodayFeed() {
  const now = new Date();
  const dayStart = startOfDay(now);
  const dayEnd = endOfDay(now);
  const staleFrom = subDays(now, 2);

  const [newRequests, needsInfo, active, todayPlan, awaitingPayment, stale] = await Promise.all([
    prisma.request.findMany({
      where: { status: "NEW" },
      include: requestInclude,
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.request.findMany({
      where: {
        status: { in: ["NEW", "ACCEPTED", "SCHEDULED"] },
        OR: [{ addressId: null }, { serviceId: null }],
      },
      include: requestInclude,
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.request.findMany({
      where: { status: { in: ACTIVE_STATUSES } },
      include: requestInclude,
      orderBy: [{ scheduledAt: "asc" }, { updatedAt: "desc" }],
      take: 10,
    }),
    prisma.request.findMany({
      where: { scheduledAt: { gte: dayStart, lte: dayEnd }, status: { notIn: ["DONE", "CANCELLED"] } },
      include: requestInclude,
      orderBy: { scheduledAt: "asc" },
      take: 10,
    }),
    prisma.request.findMany({
      where: {
        status: { in: ["AWAITING_PAYMENT", "DONE"] },
        paymentStatus: { not: "PAID" },
      },
      include: requestInclude,
      orderBy: { updatedAt: "desc" },
      take: 8,
    }),
    prisma.request.findMany({
      where: {
        status: { notIn: ["DONE", "CANCELLED"] },
        createdAt: { lt: staleFrom },
      },
      include: requestInclude,
      orderBy: { createdAt: "asc" },
      take: 8,
    }),
  ]);

  const attentionCount = newRequests.length + needsInfo.length + awaitingPayment.length + stale.length;
  const paidToday = await prisma.request.findMany({
    where: { paymentStatus: "PAID", updatedAt: { gte: dayStart, lte: dayEnd } },
    select: { price: true },
  });
  const revenueToday = paidToday.reduce((sum, request) => sum + (request.price || 0), 0);

  return (
    <div className="mx-auto max-w-[1180px] space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-fg">
            {format(now, "EEEE, d MMMM", { locale: ru })}
          </div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Рабочий стол</h1>
          <p className="mt-1 text-sm text-muted-fg">То, что требует решения сейчас: новые заявки, выезды, оплаты и зависшие задачи.</p>
        </div>
        <Link href="/crm/requests" className="btn-outline h-10 px-4">
          Все заявки <ArrowRight className="h-4 w-4" />
        </Link>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={AlertCircle} label="Требует внимания" value={attentionCount} tone={attentionCount ? "attention" : "muted"} />
        <Metric icon={Route} label="В работе" value={active.length} tone={active.length ? "work" : "muted"} />
        <Metric icon={CalendarDays} label="В плане сегодня" value={todayPlan.length} tone={todayPlan.length ? "planned" : "muted"} />
        <Metric icon={CreditCard} label="Оплачено сегодня" value={formatRub(revenueToday)} tone="paid" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr),360px]">
        <main className="space-y-5">
          <WorkbenchSection
            title="Новые заявки"
            subtitle="Нужно принять, уточнить или назначить"
            items={newRequests}
            empty="Новых заявок нет."
            href="/crm/requests?queue=new"
          />

          <WorkbenchSection
            title="Сейчас в работе"
            subtitle="Мастер уже принял, едет или выполняет"
            items={active}
            empty="Активных заявок сейчас нет."
            href="/crm/requests?queue=active"
          />

          <WorkbenchSection
            title="План на сегодня"
            subtitle="Назначенные выезды на текущий день"
            items={todayPlan}
            empty="На сегодня ничего не назначено."
            href="/crm/calendar"
          />
        </main>

        <aside className="space-y-5">
          <SideSection title="Нужно уточнить" items={dedupe(needsInfo)} empty="Все основные данные заполнены." href="/crm/requests?queue=info" />
          <SideSection title="Ждут оплату" items={awaitingPayment} empty="Долгов по закрытым работам нет." href="/crm/money" />
          <SideSection title="Зависли" items={stale} empty="Старых открытых заявок нет." href="/crm/requests?queue=stale" />
        </aside>
      </div>
    </div>
  );
}

const requestInclude = {
  client: true,
  service: true,
  address: true,
  assignedTo: true,
} as const;

interface RequestCardData {
  id: string;
  number: number;
  status: string;
  scheduledAt: Date | null;
  createdAt: Date;
  durationMin: number;
  printerInfo: string | null;
  comment: string | null;
  price: number | null;
  paymentStatus: string;
  client: { id: string; name: string; phone: string };
  service: { name: string } | null;
  address: { address: string; district: string | null } | null;
  assignedTo: { name: string } | null;
}

function WorkbenchSection({
  title,
  subtitle,
  items,
  empty,
  href,
}: {
  title: string;
  subtitle: string;
  items: RequestCardData[];
  empty: string;
  href: string;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <h2 className="font-semibold">{title}</h2>
          <div className="text-sm text-muted-fg">{subtitle}</div>
        </div>
        <Link href={href} className="text-sm text-primary hover:underline">Открыть</Link>
      </div>
      {items.length > 0 ? (
        <div className="divide-y divide-border">
          {items.slice(0, 5).map((request) => <RequestRow key={request.id} request={request} />)}
        </div>
      ) : (
        <div className="px-4 py-8 text-sm text-muted-fg">{empty}</div>
      )}
    </section>
  );
}

function SideSection({
  title,
  items,
  empty,
  href,
}: {
  title: string;
  items: RequestCardData[];
  empty: string;
  href: string;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h2 className="font-semibold">{title}</h2>
        <Link href={href} className="text-xs text-primary hover:underline">Все</Link>
      </div>
      {items.length > 0 ? (
        <div className="divide-y divide-border">
          {items.slice(0, 4).map((request) => <CompactRow key={request.id} request={request} />)}
        </div>
      ) : (
        <div className="px-4 py-6 text-sm text-muted-fg">{empty}</div>
      )}
    </section>
  );
}

function RequestRow({ request }: { request: RequestCardData }) {
  return (
    <div className="px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Link href={`/crm/requests/${request.id}`} className="block min-w-0 hover:text-primary">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-muted-fg">#{request.number}</span>
              <StatusBadge status={request.status} size="sm" />
              {request.address?.district && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-fg">{request.address.district}</span>}
            </div>
            <div className="mt-1 font-semibold">{request.client.name}</div>
            <div className="mt-0.5 text-sm text-muted-fg">{request.service?.name || "Услуга не указана"}</div>
          </Link>
          <MetaLine request={request} />
        </div>
        <QuickActionButton requestId={request.id} status={request.status} size="sm" showCancel={request.status === "NEW"} />
      </div>
    </div>
  );
}

function CompactRow({ request }: { request: RequestCardData }) {
  return (
    <Link href={`/crm/requests/${request.id}`} className="block px-4 py-3 hover:bg-muted/25">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-muted-fg">#{request.number}</span>
            <StatusBadge status={request.status} size="sm" />
          </div>
          <div className="mt-1 truncate text-sm font-medium">{request.client.name}</div>
          <div className="truncate text-xs text-muted-fg">{request.service?.name || "Услуга не указана"}</div>
        </div>
        {request.price != null && request.price > 0 && <div className="shrink-0 text-sm tabular-nums">{formatRub(request.price)}</div>}
      </div>
    </Link>
  );
}

function MetaLine({ request }: { request: RequestCardData }) {
  return (
    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-fg">
      <a href={`tel:${request.client.phone}`} className="inline-flex items-center gap-1 hover:text-fg">
        <Phone className="h-3.5 w-3.5" /> {request.client.phone}
      </a>
      {request.address?.address && (
        <span className="inline-flex min-w-0 items-center gap-1">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{shortenSpbAddress(request.address.address) || request.address.address}</span>
        </span>
      )}
      {request.scheduledAt && (
        <span className="inline-flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" /> {format(request.scheduledAt, "d MMM HH:mm", { locale: ru })}
        </span>
      )}
      {request.assignedTo && (
        <span className="inline-flex items-center gap-1">
          <UserRound className="h-3.5 w-3.5" /> {request.assignedTo.name}
        </span>
      )}
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof AlertCircle;
  label: string;
  value: string | number;
  tone: "attention" | "work" | "planned" | "paid" | "muted";
}) {
  const color = {
    attention: "border-[#FECACA] bg-[#FEE2E2] text-[#B91C1C]",
    work: "border-[#FED7AA] bg-[#FFF7ED] text-[#C2410C]",
    planned: "border-[#C7D2FE] bg-[#EEF2FF] text-[#3730A3]",
    paid: "border-[#BBF7D0] bg-[#DCFCE7] text-[#166534]",
    muted: "border-border bg-card text-muted-fg",
  }[tone];
  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${color}`}>
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider opacity-80">
        <Icon className="h-4 w-4" /> {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function dedupe(items: RequestCardData[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}
