import Link from "next/link";
import { prisma } from "@/lib/db";
import { startOfDay, endOfDay, format, isPast, formatDistanceToNowStrict } from "date-fns";
import { ru } from "date-fns/locale";
import { Phone, MapPin, Clock, AlertCircle, ChevronRight } from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import { QuickActionButton } from "./QuickActionButton";
import { formatRub } from "@/lib/utils";

export async function TodayFeed() {
  const now = new Date();
  const dayStart = startOfDay(now);
  const dayEnd = endOfDay(now);

  const allToday = await prisma.request.findMany({
    where: {
      OR: [
        { status: { in: ["IN_PROGRESS", "EN_ROUTE"] } },
        { scheduledAt: { gte: dayStart, lte: dayEnd } },
        { status: "NEW", scheduledAt: null },
        { updatedAt: { gte: dayStart, lte: dayEnd }, status: { in: ["DONE", "CANCELLED"] } },
      ],
    },
    include: { client: true, service: true, address: true, assignedTo: true },
    orderBy: [{ scheduledAt: "asc" }, { createdAt: "asc" }],
  });

  const active = allToday.filter((r) => r.status === "IN_PROGRESS" || r.status === "EN_ROUTE");
  const upcoming = allToday.filter((r) =>
    r.status === "SCHEDULED" && r.scheduledAt && r.scheduledAt >= now
  );
  const overdue = allToday.filter((r) =>
    r.status === "SCHEDULED" && r.scheduledAt && r.scheduledAt < now
  );
  const newOnes = allToday.filter((r) => r.status === "NEW");
  const awaiting = allToday.filter((r) => r.status === "AWAITING_PAYMENT");
  const finishedToday = allToday.filter((r) => r.status === "DONE" || r.status === "CANCELLED");

  const totalToday = upcoming.length + active.length + overdue.length;
  const revenueToday = finishedToday
    .filter((r) => r.paymentStatus === "PAID")
    .reduce((s, r) => s + (r.price || 0), 0);

  return (
    <div className="space-y-6">
      {/* Шапка */}
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-fg">
            {format(now, "EEEE, d MMMM", { locale: ru })}
          </div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Сегодня</h1>
        </div>
        <div className="flex gap-3">
          <Stat label="на сегодня" value={String(totalToday)} />
          <Stat label="новых" value={String(newOnes.length)} tone={newOnes.length ? "amber" : "muted"} />
          <Stat label="выручка" value={formatRub(revenueToday)} tone="primary" />
        </div>
      </header>

      {/* СЕЙЧАС */}
      {active.length > 0 && (
        <Section title="Сейчас" subtitle={`${active.length} активная${active.length > 1 ? "х" : ""}`} accent="violet">
          <div className="grid gap-3">
            {active.map((r) => <BigCard key={r.id} r={r} now={now} highlight />)}
          </div>
        </Section>
      )}

      {/* ОПОЗДАНИЯ */}
      {overdue.length > 0 && (
        <Section title="Опоздания" subtitle="время вышло, не начато" accent="red">
          <div className="grid gap-3">
            {overdue.map((r) => <BigCard key={r.id} r={r} now={now} overdue />)}
          </div>
        </Section>
      )}

      {/* ДАЛЬШЕ СЕГОДНЯ */}
      {upcoming.length > 0 && (
        <Section title="Дальше сегодня" subtitle={`${upcoming.length} запланировано`} accent="blue">
          <div className="grid gap-3">
            {upcoming.map((r) => <BigCard key={r.id} r={r} now={now} />)}
          </div>
        </Section>
      )}

      {/* ОЖИДАЮТ ОПЛАТЫ */}
      {awaiting.length > 0 && (
        <Section title="Ждут оплаты" subtitle="работа сделана, деньги не пришли" accent="orange">
          <div className="grid gap-3">
            {awaiting.map((r) => <BigCard key={r.id} r={r} now={now} />)}
          </div>
        </Section>
      )}

      {/* НОВЫЕ БЕЗ ДАТЫ */}
      {newOnes.length > 0 && (
        <Section title="Новые без даты" subtitle="нужно перезвонить и записать" accent="amber">
          <div className="grid gap-3">
            {newOnes.map((r) => <BigCard key={r.id} r={r} now={now} />)}
          </div>
        </Section>
      )}

      {/* ВСЁ ЧИСТО */}
      {totalToday === 0 && newOnes.length === 0 && awaiting.length === 0 && (
        <div className="card p-10 text-center">
          <div className="text-2xl">🎉</div>
          <div className="mt-3 font-semibold">На сегодня всё чисто</div>
          <div className="mt-1 text-sm text-muted-fg">Можно прогуляться, выпить кофе, попечатать тестовую страничку.</div>
        </div>
      )}

      {/* СДЕЛАНО */}
      {finishedToday.length > 0 && (
        <details className="card group">
          <summary className="cursor-pointer list-none px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xs uppercase tracking-wider text-muted-fg">Завершено сегодня</span>
              <span className="text-sm font-medium">{finishedToday.length}</span>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-fg group-open:rotate-90 transition" />
          </summary>
          <div className="border-t border-border divide-y divide-border">
            {finishedToday.map((r) => (
              <Link key={r.id} href={`/crm/requests/${r.id}`} className="block px-5 py-3 hover:bg-muted/30 flex items-center justify-between gap-3">
                <div className="text-sm">
                  <span className="text-muted-fg font-mono mr-3">#{r.number}</span>
                  {r.client.name}
                  <span className="text-muted-fg ml-2">· {r.service?.name || "—"}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs tabular-nums text-muted-fg">{formatRub(r.price)}</span>
                  <StatusBadge status={r.status} size="sm" />
                </div>
              </Link>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function Section({ title, subtitle, accent, children }: { title: string; subtitle?: string; accent?: string; children: React.ReactNode }) {
  const accentColor = {
    violet: "bg-violet-500",
    blue: "bg-blue-500",
    red: "bg-red-500",
    orange: "bg-orange-500",
    amber: "bg-amber-500",
  }[accent || ""] || "bg-primary";
  return (
    <section>
      <div className="flex items-baseline gap-3 mb-3">
        <span className={`h-2 w-2 rounded-full ${accentColor}`} />
        <h2 className="text-sm font-semibold uppercase tracking-wider">{title}</h2>
        {subtitle && <span className="text-xs text-muted-fg">{subtitle}</span>}
      </div>
      {children}
    </section>
  );
}

function Stat({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "primary" | "amber" | "muted" }) {
  const color = {
    default: "text-fg",
    primary: "text-primary",
    amber: "text-amber-500",
    muted: "text-muted-fg",
  }[tone];
  return (
    <div className="card px-4 py-2.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-fg">{label}</div>
      <div className={`text-xl font-semibold tabular-nums ${color}`}>{value}</div>
    </div>
  );
}

interface RequestForCard {
  id: string;
  number: number;
  status: string;
  scheduledAt: Date | null;
  durationMin: number;
  printerInfo: string | null;
  comment: string | null;
  price: number | null;
  client: { id: string; name: string; phone: string };
  service: { name: string } | null;
  address: { address: string } | null;
  assignedTo: { name: string } | null;
}

function BigCard({ r, now, highlight, overdue }: { r: RequestForCard; now: Date; highlight?: boolean; overdue?: boolean }) {
  const time = r.scheduledAt ? format(r.scheduledAt, "HH:mm") : null;
  const relative = r.scheduledAt
    ? r.scheduledAt > now
      ? `через ${formatDistanceToNowStrict(r.scheduledAt, { locale: ru })}`
      : `${formatDistanceToNowStrict(r.scheduledAt, { locale: ru })} назад`
    : null;

  return (
    <div className={`card p-5 transition relative overflow-hidden ${highlight ? "ring-2 ring-violet-500/40" : ""}`}>
      {highlight && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-500 via-violet-400 to-violet-500" />
      )}
      <div className="flex items-start gap-4">
        {/* Время / иконка */}
        <div className="shrink-0 text-center min-w-[64px]">
          {time ? (
            <>
              <div className={`text-2xl font-semibold tabular-nums ${overdue ? "text-red-400" : "text-fg"}`}>{time}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-fg mt-0.5">{r.durationMin} мин</div>
            </>
          ) : (
            <div className="flex flex-col items-center text-muted-fg">
              <AlertCircle className="h-7 w-7" />
              <div className="text-[10px] uppercase tracking-wider mt-1">без даты</div>
            </div>
          )}
        </div>

        {/* Основное */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs text-muted-fg">#{r.number}</span>
            <Link href={`/crm/clients/${r.client.id}`} className="font-semibold hover:text-primary truncate">{r.client.name}</Link>
            <StatusBadge status={r.status} size="sm" />
            {relative && <span className="text-xs text-muted-fg">· {relative}</span>}
          </div>
          <div className="mt-1 text-sm text-fg/85">
            {r.service?.name || "Услуга не указана"}
            {r.printerInfo && <span className="text-muted-fg"> · {r.printerInfo}</span>}
          </div>
          <div className="mt-2 grid sm:grid-cols-2 gap-2 text-xs text-muted-fg">
            {r.address && (
              <div className="flex items-center gap-1.5 min-w-0">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{r.address.address}</span>
              </div>
            )}
            <a href={`tel:${r.client.phone}`} className="flex items-center gap-1.5 hover:text-fg">
              <Phone className="h-3.5 w-3.5" /> {r.client.phone}
            </a>
            {r.assignedTo && (
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" /> {r.assignedTo.name}
              </div>
            )}
          </div>
          {r.comment && (
            <div className="mt-2 text-xs text-muted-fg leading-relaxed line-clamp-2">«{r.comment}»</div>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
        <Link href={`/crm/requests/${r.id}`} className="text-xs text-muted-fg hover:text-fg inline-flex items-center gap-1">
          Открыть карточку <ChevronRight className="h-3 w-3" />
        </Link>
        <QuickActionButton requestId={r.id} status={r.status} size="md" showCancel={r.status === "NEW"} />
      </div>
    </div>
  );
}
