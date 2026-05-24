import Link from "next/link";
import { endOfDay, endOfMonth, format, startOfDay, startOfMonth } from "date-fns";
import { ru } from "date-fns/locale";
import { ArrowRight, Banknote, CheckCircle2, Clock, WalletCards } from "lucide-react";
import { prisma } from "@/lib/db";
import { formatRub } from "@/lib/utils";
import { StatusBadge } from "@/components/crm/StatusBadge";

export const dynamic = "force-dynamic";

export default async function MoneyPage() {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const [paidToday, paidMonth, unpaid, awaiting] = await Promise.all([
    prisma.request.findMany({
      where: { paymentStatus: "PAID", updatedAt: { gte: todayStart, lte: todayEnd } },
      include: { client: true, service: true, assignedTo: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.request.findMany({
      where: { paymentStatus: "PAID", updatedAt: { gte: monthStart, lte: monthEnd } },
      select: { price: true },
    }),
    prisma.request.findMany({
      where: {
        status: { notIn: ["CANCELLED"] },
        paymentStatus: { not: "PAID" },
        price: { gt: 0 },
      },
      include: { client: true, service: true, assignedTo: true },
      orderBy: [{ updatedAt: "desc" }],
      take: 50,
    }),
    prisma.request.findMany({
      where: { status: "AWAITING_PAYMENT" },
      include: { client: true, service: true, assignedTo: true },
      orderBy: [{ updatedAt: "desc" }],
      take: 20,
    }),
  ]);

  const revenueToday = paidToday.reduce((sum, r) => sum + (r.price || 0), 0);
  const revenueMonth = paidMonth.reduce((sum, r) => sum + (r.price || 0), 0);
  const debt = unpaid.reduce((sum, r) => sum + (r.price || 0), 0);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-fg">
            {format(now, "LLLL yyyy", { locale: ru })}
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Деньги</h1>
          <p className="mt-1 text-sm text-muted-fg">Оплаты, долги и закрытые работы отдельно от заявок.</p>
        </div>
        <Link href="/crm/stats" className="btn-ghost h-10 text-sm">
          Отчёты <ArrowRight className="h-4 w-4" />
        </Link>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <MoneyStat icon={Banknote} label="Сегодня оплачено" value={formatRub(revenueToday)} tone="paid" />
        <MoneyStat icon={WalletCards} label="За месяц" value={formatRub(revenueMonth)} tone="planned" />
        <MoneyStat icon={Clock} label="К оплате" value={formatRub(debt)} tone={debt ? "payment" : "muted"} />
      </div>

      <section className="card overflow-hidden">
        <div className="border-b border-border px-4 py-3">
          <h2 className="font-semibold">Нужно получить оплату</h2>
          <div className="text-sm text-muted-fg">Заявки с суммой и неоплаченной/частичной оплатой.</div>
        </div>
        <RequestMoneyList items={unpaid} empty="Долгов нет." />
      </section>

      {awaiting.length > 0 && (
        <section className="card overflow-hidden">
          <div className="border-b border-border px-4 py-3">
            <h2 className="font-semibold">Статус “ожидает оплаты”</h2>
            <div className="text-sm text-muted-fg">Старый статус оставлен для совместимости и контроля.</div>
          </div>
          <RequestMoneyList items={awaiting} empty="Нет заявок в ожидании оплаты." />
        </section>
      )}

      <section className="card overflow-hidden">
        <div className="border-b border-border px-4 py-3">
          <h2 className="font-semibold">Оплачено сегодня</h2>
          <div className="text-sm text-muted-fg">Быстрая сверка закрытых денег за день.</div>
        </div>
        <RequestMoneyList items={paidToday} empty="Сегодня оплат пока нет." />
      </section>
    </div>
  );
}

function MoneyStat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof WalletCards;
  label: string;
  value: string;
  tone: "planned" | "paid" | "payment" | "muted";
}) {
  const color = {
    planned: "border-[#C7D2FE] bg-[#EEF2FF] text-[#3730A3]",
    paid: "border-[#BBF7D0] bg-[#DCFCE7] text-[#166534]",
    payment: "border-[#FDE68A] bg-[#FEF3C7] text-[#92400E]",
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

type MoneyRequest = {
  id: string;
  number: number;
  status: string;
  paymentStatus: string;
  price: number | null;
  updatedAt: Date;
  client: { name: string };
  service: { name: string } | null;
  assignedTo: { name: string } | null;
};

function RequestMoneyList({ items, empty }: { items: MoneyRequest[]; empty: string }) {
  if (items.length === 0) {
    return <div className="px-4 py-8 text-center text-sm text-muted-fg">{empty}</div>;
  }

  return (
    <div className="divide-y divide-border">
      {items.map((request) => (
        <Link key={request.id} href={`/crm/requests/${request.id}`} className="block px-4 py-3 hover:bg-muted/25">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-muted-fg">#{request.number}</span>
                <StatusBadge status={request.status} size="sm" />
                {request.paymentStatus === "PAID" && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-[#BBF7D0] bg-[#DCFCE7] px-2 py-0.5 text-[10px] font-semibold text-[#166534]">
                    <CheckCircle2 className="h-3 w-3" /> оплачено
                  </span>
                )}
              </div>
              <div className="mt-1 truncate font-medium">{request.client.name}</div>
              <div className="mt-0.5 text-sm text-muted-fg">
                {request.service?.name || "Услуга не указана"}
                {request.assignedTo ? ` · ${request.assignedTo.name}` : ""}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="font-semibold tabular-nums">{formatRub(request.price)}</div>
              <div className="mt-1 text-xs text-muted-fg">{format(request.updatedAt, "d MMM, HH:mm", { locale: ru })}</div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
