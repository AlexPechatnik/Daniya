import Link from "next/link";
import { prisma } from "@/lib/db";
import { endOfDay, format, parseISO, startOfDay, subDays } from "date-fns";
import { ru } from "date-fns/locale";
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  ChevronRight,
  Clock,
  CreditCard,
  Inbox as InboxIcon,
  MapPin,
  Phone,
  Route,
} from "lucide-react";
import { StatusBadge } from "../StatusBadge";
import { QuickActionButton } from "../QuickActionButton";
import { formatRub } from "@/lib/utils";
import { shortenSpbAddress } from "@/lib/address";
import { EmptyState } from "../EmptyState";

const ACTIVE_STATUSES = ["EN_ROUTE", "ON_SITE", "IN_PROGRESS"];

/**
 * Мобильный рабочий стол одного-человека-бизнеса.
 *
 * Цель: один экран, на котором видно «что сейчас и что дальше».
 * Без многоколонок, без длинных списков — сразу видно то, что нужно действовать.
 *
 * Структура:
 *   1. Hero — что сейчас в работе (1 активная заявка с QuickAction)
 *   2. Метрики 2×2 (требует внимания / в плане / в работе / оплачено)
 *   3. Список «Требует внимания» (нов., нужно уточнить, оплаты, зависли)
 *   4. CTA «Все заявки»
 */
export async function DashboardMobile() {
  const now = new Date();
  const dayStart = startOfDay(now);
  const dayEnd = endOfDay(now);
  const staleFrom = subDays(now, 2);

  const [newRequests, needsInfo, active, todayPlan, awaitingPayment, stale, paidToday] =
    await Promise.all([
      prisma.request.findMany({
        where: { status: "NEW" },
        include: requestInclude,
        orderBy: { createdAt: "desc" },
        take: 6,
      }),
      prisma.request.findMany({
        where: {
          status: { in: ["NEW", "ACCEPTED", "SCHEDULED"] },
          OR: [{ addressId: null }, { serviceId: null }],
        },
        include: requestInclude,
        orderBy: { createdAt: "desc" },
        take: 4,
      }),
      prisma.request.findMany({
        where: { status: { in: ACTIVE_STATUSES } },
        include: requestInclude,
        orderBy: [{ scheduledAt: "asc" }, { updatedAt: "desc" }],
        take: 3,
      }),
      prisma.request.findMany({
        where: { scheduledAt: { gte: dayStart, lte: dayEnd }, status: { notIn: ["DONE", "CANCELLED"] } },
        include: requestInclude,
        orderBy: { scheduledAt: "asc" },
        take: 6,
      }),
      prisma.request.findMany({
        where: {
          status: { in: ["AWAITING_PAYMENT", "DONE"] },
          paymentStatus: { not: "PAID" },
        },
        include: requestInclude,
        orderBy: { updatedAt: "desc" },
        take: 4,
      }),
      prisma.request.findMany({
        where: { status: { notIn: ["DONE", "CANCELLED"] }, createdAt: { lt: staleFrom } },
        include: requestInclude,
        orderBy: { createdAt: "asc" },
        take: 4,
      }),
      prisma.request.findMany({
        where: { paymentStatus: "PAID", updatedAt: { gte: dayStart, lte: dayEnd } },
        select: { price: true },
      }),
    ]);

  const attentionCount = newRequests.length + needsInfo.length + awaitingPayment.length + stale.length;
  const revenueToday = paidToday.reduce((s, r) => s + (r.price || 0), 0);
  // Самая «активная» заявка — приоритет по статусу: IN_PROGRESS > ON_SITE > EN_ROUTE
  const hero =
    active.find((r) => r.status === "IN_PROGRESS") ||
    active.find((r) => r.status === "ON_SITE") ||
    active.find((r) => r.status === "EN_ROUTE") ||
    active[0] ||
    todayPlan[0];

  // Дедуп для «Требует внимания»: одна заявка не должна появляться дважды
  const attentionSeen = new Set<string>();
  const attention = [...newRequests, ...needsInfo, ...awaitingPayment, ...stale].filter((r) => {
    if (attentionSeen.has(r.id)) return false;
    attentionSeen.add(r.id);
    return true;
  });

  return (
    <div className="space-y-4 pb-4">
      {/* Заголовок */}
      <div>
        <div className="text-xs uppercase tracking-wider text-muted-fg">
          {format(now, "EEEE, d MMMM", { locale: ru })}
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Рабочий стол</h1>
      </div>

      {/* Hero: что прямо сейчас */}
      {hero && <HeroActive request={hero} />}

      {/* 2×2 метрики */}
      <div className="grid grid-cols-2 gap-2.5">
        <Metric
          href="/crm/requests"
          icon={AlertCircle}
          tone="red"
          value={attentionCount}
          label="Требует внимания"
        />
        <Metric
          href="/crm/requests?queue=active"
          icon={Route}
          tone="orange"
          value={active.length}
          label="В работе"
        />
        <Metric
          href="/crm/calendar"
          icon={CalendarDays}
          tone="purple"
          value={todayPlan.length}
          label="В плане сегодня"
        />
        <Metric
          href="/crm/money"
          icon={CreditCard}
          tone="green"
          value={formatRub(revenueToday)}
          label="Оплачено сегодня"
        />
      </div>

      {/* План на сегодня */}
      {todayPlan.length > 0 && (
        <Section title="План на сегодня" href="/crm/calendar" subtitle={`${todayPlan.length} выездов`}>
          {todayPlan.slice(0, 5).map((r) => <Row key={r.id} request={r} showTime />)}
        </Section>
      )}

      {/* Требует внимания */}
      <Section title="Требует внимания" href="/crm/requests">
        {attention.length > 0 ? (
          attention.slice(0, 6).map((r) => <Row key={r.id} request={r} />)
        ) : (
          <EmptyState
            icon={InboxIcon}
            tone="green"
            compact
            title="Всё под контролем"
            hint="Свежие заявки и оплаты обработаны."
          />
        )}
      </Section>
    </div>
  );
}

/* ════════ Hero — активная заявка ════════ */

function HeroActive({ request }: { request: RequestData }) {
  const meta = statusToHeroTone(request.status);
  const time = request.scheduledAt
    ? format(request.scheduledAt, "HH:mm")
    : null;
  const address = shortenSpbAddress(request.address?.address);
  return (
    <section className={`overflow-hidden rounded-2xl border ${meta.border} ${meta.bg}`}>
      <Link href={`/crm/requests/${request.id}`} className="block px-4 py-4 active:opacity-80">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-fg">
          Сейчас в работе
        </div>
        <div className="mt-1 flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-muted-fg">#{request.number}</span>
              <StatusBadge status={request.status} size="sm" />
              {time && <span className="text-xs text-muted-fg">· {time}</span>}
            </div>
            <div className="mt-1 truncate text-lg font-semibold">{request.client.name}</div>
            <div className="truncate text-sm text-muted-fg">{request.service?.name || "Без услуги"}</div>
            {address && (
              <div className="mt-1.5 flex items-start gap-1.5 text-sm text-fg/80">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#DC2626]" />
                <span className="truncate">{address}</span>
              </div>
            )}
          </div>
          <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-fg" />
        </div>
      </Link>
      <div className="flex items-center justify-between gap-2 border-t border-border/60 bg-card/60 px-3 py-2">
        <a
          href={`tel:${request.client.phone}`}
          className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-fg active:bg-muted/40"
        >
          <Phone className="h-3.5 w-3.5 text-[#2563EB]" /> {request.client.phone}
        </a>
        <QuickActionButton requestId={request.id} status={request.status} size="sm" />
      </div>
    </section>
  );
}

function statusToHeroTone(status: string) {
  if (status === "IN_PROGRESS") return { bg: "bg-[#FFEDD5]/50", border: "border-[#FDBA74]" };
  if (status === "ON_SITE") return { bg: "bg-[#FCE7F3]/40", border: "border-[#F9A8D4]" };
  if (status === "EN_ROUTE") return { bg: "bg-[#E0F2FE]/50", border: "border-[#7DD3FC]" };
  return { bg: "bg-card", border: "border-border" };
}

/* ════════ Метрика-плитка ════════ */

const TONES = {
  red:    "bg-[#FEE2E2] text-[#DC2626]",
  orange: "bg-[#FFEDD5] text-[#EA580C]",
  green:  "bg-[#DCFCE7] text-[#16A34A]",
  purple: "bg-[#F3E8FF] text-[#9333EA]",
  blue:   "bg-[#DBEAFE] text-[#2563EB]",
} as const;

function Metric({
  href,
  icon: Icon,
  value,
  label,
  tone,
}: {
  href: string;
  icon: typeof Route;
  value: number | string;
  label: string;
  tone: keyof typeof TONES;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-2xl border border-border bg-card px-3 py-3 transition active:bg-muted/40"
    >
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${TONES[tone]}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-lg font-semibold tabular-nums leading-tight">{value}</div>
        <div className="truncate text-[11px] text-muted-fg">{label}</div>
      </div>
    </Link>
  );
}

/* ════════ Секция со списком ════════ */

function Section({
  title,
  subtitle,
  href,
  children,
}: {
  title: string;
  subtitle?: string;
  href?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-baseline justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <h2 className="font-semibold">{title}</h2>
          {subtitle && <div className="text-xs text-muted-fg">{subtitle}</div>}
        </div>
        {href && (
          <Link href={href} className="text-xs font-medium text-primary">
            Все <ArrowRight className="inline h-3 w-3" />
          </Link>
        )}
      </div>
      <div className="divide-y divide-border">{children}</div>
    </section>
  );
}

function Row({ request, showTime = false }: { request: RequestData; showTime?: boolean }) {
  const address = shortenSpbAddress(request.address?.address);
  const time = request.scheduledAt ? format(request.scheduledAt, "HH:mm") : null;
  return (
    <Link
      href={`/crm/requests/${request.id}`}
      className="flex items-start gap-3 px-4 py-3 transition active:bg-muted/40"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {showTime && time && (
            <span className="font-mono text-xs font-semibold text-primary tabular-nums">{time}</span>
          )}
          <span className="font-mono text-[11px] text-muted-fg">#{request.number}</span>
          <StatusBadge status={request.status} size="sm" />
        </div>
        <div className="mt-0.5 truncate text-sm font-medium">{request.client.name}</div>
        {address && <div className="truncate text-xs text-muted-fg">{address}</div>}
      </div>
      <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-fg/60" />
    </Link>
  );
}

/* ════════ Types ════════ */

const requestInclude = {
  client: true,
  service: true,
  address: true,
  assignedTo: true,
} as const;

type RequestData = {
  id: string;
  number: number;
  status: string;
  scheduledAt: Date | null;
  client: { id: string; name: string; phone: string };
  service: { name: string } | null;
  address: { address: string } | null;
  price: number | null;
};
