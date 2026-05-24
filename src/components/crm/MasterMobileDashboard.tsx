import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { endOfDay, format, formatDistanceToNowStrict, startOfDay } from "date-fns";
import { ru } from "date-fns/locale";
import { CheckCircle2, ChevronRight, History, ListChecks, LogOut, MapPin, MessageCircle, Navigation, Phone, Play, UserCircle } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { StatusBadge } from "./StatusBadge";
import { QuickActionButton } from "./QuickActionButton";
import { formatRub } from "@/lib/utils";

type MasterTab = "new" | "mine" | "active" | "done" | "profile";

const ACTIVE_STATUSES = ["ACCEPTED", "SCHEDULED", "EN_ROUTE", "ON_SITE", "IN_PROGRESS", "AWAITING_PAYMENT"];
const actionTileClass = "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-border bg-card px-2 text-sm font-semibold text-fg shadow-sm transition hover:bg-muted";

export async function MasterMobileDashboard({ tab = "new" }: { tab?: string }) {
  const user = await requireUser();
  const currentTab = normalizeTab(tab);
  const todayStart = startOfDay(new Date());
  const todayEnd = endOfDay(new Date());

  const [newRequests, myRequests, activeNow, doneToday] = await Promise.all([
    prisma.request.findMany({
      where: { status: "NEW", assignedToId: null },
      include: requestInclude,
      orderBy: [{ createdAt: "desc" }],
      take: 40,
    }),
    prisma.request.findMany({
      where: { assignedToId: user.id, status: { in: ACTIVE_STATUSES } },
      include: requestInclude,
      orderBy: [{ updatedAt: "desc" }],
      take: 40,
    }),
    prisma.request.findMany({
      where: { assignedToId: user.id, status: { in: ["EN_ROUTE", "ON_SITE", "IN_PROGRESS"] } },
      include: requestInclude,
      orderBy: [{ updatedAt: "desc" }],
      take: 20,
    }),
    prisma.request.findMany({
      where: {
        assignedToId: user.id,
        status: "DONE",
        updatedAt: { gte: todayStart, lte: todayEnd },
      },
      include: requestInclude,
      orderBy: [{ updatedAt: "desc" }],
      take: 30,
    }),
  ]);

  const tabs = [
    { id: "new", label: "Новые", icon: ListChecks, count: newRequests.length },
    { id: "mine", label: "Мои", icon: CheckCircle2, count: myRequests.length },
    { id: "active", label: "Сейчас", icon: Play, count: activeNow.length },
    { id: "done", label: "Готово", icon: History, count: doneToday.length },
    { id: "profile", label: "Профиль", icon: UserCircle, count: null },
  ] as const;

  const visibleRequests =
    currentTab === "new" ? newRequests :
    currentTab === "mine" ? myRequests :
    currentTab === "active" ? activeNow :
    currentTab === "done" ? doneToday :
    [];

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <header className="space-y-3">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-fg">
            {format(new Date(), "EEEE, d MMMM", { locale: ru })}
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Работа мастера</h1>
          <p className="mt-1 text-sm text-muted-fg">Очередь заявок без расписания по слотам. Берите следующую удобную по маршруту.</p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Counter label="новые" value={newRequests.length} tone={newRequests.length ? "new" : "muted"} />
          <Counter label="мои" value={myRequests.length} tone="planned" />
          <Counter label="в работе" value={activeNow.length} tone={activeNow.length ? "work" : "muted"} />
        </div>
      </header>

      <nav className="grid grid-cols-5 gap-1 rounded-2xl border border-border bg-card/40 p-1 sticky top-16 z-20 backdrop-blur">
        {tabs.map((item) => {
          const active = currentTab === item.id;
          return (
            <Link
              key={item.id}
              href={`/crm/mobile?tab=${item.id}`}
              className={`min-h-14 rounded-xl px-1.5 py-2 text-center text-[11px] transition ${
                active ? "bg-primary text-primary-fg" : "text-muted-fg hover:bg-muted hover:text-fg"
              }`}
            >
              <item.icon className="mx-auto h-4 w-4" />
              <span className="mt-1 block leading-none">{item.label}</span>
              {item.count != null && item.count > 0 && (
                <span className={`mt-1 inline-flex min-w-5 justify-center rounded-full px-1.5 text-[10px] ${active ? "bg-black/20" : "bg-muted text-fg"}`}>
                  {item.count}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {currentTab === "profile" ? (
        <ProfileBlock name={user.name} role={user.role} />
      ) : (
        <section className="space-y-3">
          <SectionTitle tab={currentTab} count={visibleRequests.length} />
          {visibleRequests.length > 0 ? (
            visibleRequests.map((request) => <MasterJobCard key={request.id} request={request} />)
          ) : (
            <EmptyState tab={currentTab} />
          )}
        </section>
      )}
    </div>
  );
}

const requestInclude = {
  client: true,
  service: true,
  address: true,
  assignedTo: true,
} as const;

type MasterRequest = Prisma.RequestGetPayload<{ include: typeof requestInclude }>;

function MasterJobCard({ request }: { request: MasterRequest }) {
  const routeHref = buildRouteHref(request.address);
  const smsHref = `sms:${request.client.phone}`;
  const createdAgo = formatDistanceToNowStrict(request.createdAt, { locale: ru, addSuffix: true });

  return (
    <article className="rounded-2xl border border-border bg-card/55 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-muted-fg">#{request.number}</span>
            <StatusBadge status={request.status} size="sm" />
            {request.address?.district && (
              <span className="rounded-full border border-border bg-bg/50 px-2 py-0.5 text-[10px] text-muted-fg">
                {request.address.district}
              </span>
            )}
          </div>
          <h2 className="mt-2 truncate text-xl font-semibold">{request.client.name}</h2>
          <div className="mt-1 text-sm text-fg/85">
            {request.service?.name || "Услуга не указана"}
            {request.printerInfo && <span className="text-muted-fg"> · {request.printerInfo}</span>}
          </div>
        </div>
        {request.price != null && request.price > 0 && (
          <div className="shrink-0 rounded-xl border border-border bg-bg/60 px-2.5 py-1.5 text-sm font-semibold tabular-nums">
            {formatRub(request.price)}
          </div>
        )}
      </div>

      {request.address?.address && (
        <div className="mt-3 rounded-xl border border-border bg-card p-3 shadow-sm">
          <div className="flex items-start gap-2 text-sm leading-snug">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#0369A1]" />
            <span>{request.address.address}</span>
          </div>
        </div>
      )}

      {request.comment && (
        <p className="mt-3 line-clamp-3 rounded-xl bg-muted/35 px-3 py-2 text-sm leading-relaxed text-fg/85">
          {request.comment}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-fg">
        <span>Создана {createdAgo}</span>
        {request.assignedTo && <span>· мастер: {request.assignedTo.name}</span>}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <a href={`tel:${request.client.phone}`} className={actionTileClass}>
          <Phone className="h-4 w-4" />
          Позвонить
        </a>
        <a href={smsHref} className={actionTileClass}>
          <MessageCircle className="h-4 w-4" />
          Написать
        </a>
        {routeHref ? (
          <a href={routeHref} target="_blank" rel="noreferrer" className={actionTileClass}>
            <Navigation className="h-4 w-4" />
            Маршрут
          </a>
        ) : (
          <Link href={`/crm/requests/${request.id}`} className={actionTileClass}>
            <ChevronRight className="h-4 w-4" />
            Открыть
          </Link>
        )}
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <QuickActionButton requestId={request.id} status={request.status} size="lg" showCancel={request.status === "NEW"} />
        <Link href={`/crm/requests/${request.id}`} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-border bg-bg/45 px-4 text-sm font-medium text-muted-fg hover:bg-muted hover:text-fg">
          Карточка <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </article>
  );
}

function Counter({ label, value, tone }: { label: string; value: number; tone: "new" | "planned" | "work" | "muted" }) {
  const color = {
    new: "border-[#BFDBFE] bg-[#EFF6FF] text-[#1D4ED8]",
    planned: "border-[#C7D2FE] bg-[#EEF2FF] text-[#3730A3]",
    work: "border-[#FED7AA] bg-[#FFF7ED] text-[#C2410C]",
    muted: "border-border bg-card text-muted-fg",
  }[tone];
  return (
    <div className={`rounded-2xl border px-3 py-2 shadow-sm ${color}`}>
      <div className="text-[10px] uppercase tracking-wider opacity-80">{label}</div>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function SectionTitle({ tab, count }: { tab: MasterTab; count: number }) {
  const title = {
    new: "Новые заявки",
    mine: "Мои заявки",
    active: "Сейчас в работе",
    done: "Готово сегодня",
    profile: "Профиль",
  }[tab];
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-base font-semibold">{title}</h2>
      <span className="text-sm text-muted-fg">{count}</span>
    </div>
  );
}

function EmptyState({ tab }: { tab: MasterTab }) {
  const text = {
    new: "Новых заявок пока нет.",
    mine: "Вы пока не приняли заявки.",
    active: "Активных выездов сейчас нет.",
    done: "Сегодня еще нет завершенных заявок.",
    profile: "",
  }[tab];
  return (
    <div className="rounded-2xl border border-border bg-card/35 p-8 text-center text-sm text-muted-fg">
      {text}
    </div>
  );
}

function ProfileBlock({ name, role }: { name: string; role: string }) {
  return (
    <section className="rounded-2xl border border-border bg-card/45 p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
          <UserCircle className="h-7 w-7" />
        </div>
        <div>
          <div className="font-semibold">{name}</div>
          <div className="text-sm text-muted-fg">{role === "ADMIN" ? "Администратор" : "Мастер"}</div>
        </div>
      </div>
      <form action="/api/auth/logout" method="POST" className="mt-5">
        <button className="btn-ghost h-12 w-full justify-center text-sm" type="submit">
          <LogOut className="h-4 w-4" /> Выйти
        </button>
      </form>
    </section>
  );
}

function normalizeTab(tab: string): MasterTab {
  if (tab === "mine" || tab === "active" || tab === "done" || tab === "profile") return tab;
  return "new";
}

function buildRouteHref(address: MasterRequest["address"]) {
  if (!address) return "";
  if (address.lat != null && address.lng != null) {
    return `https://yandex.ru/maps/?rtext=~${address.lat},${address.lng}&rtt=auto`;
  }
  if (address.address) {
    return `https://yandex.ru/maps/?text=${encodeURIComponent(address.address)}`;
  }
  return "";
}
