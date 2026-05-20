"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { TrendingUp, Banknote, Activity, Users, CheckCircle2, RotateCcw } from "lucide-react";
import { formatRub } from "@/lib/utils";
import { statusMeta } from "@/lib/status";
import { StatusBadge } from "./StatusBadge";

interface Props {
  period: string;
  revenue: number;
  avgCheck: number;
  totalRequests: number;
  doneCount: number;
  cancelledCount: number;
  conversion: number;
  repeatRate: number;
  revenueByDay: { date: string; label: string; revenue: number; count: number }[];
  byStatus: Record<string, number>;
  topServices: { name: string; count: number; revenue: number }[];
  topClients: { id: string; name: string; revenue: number; count: number }[];
}

const PERIOD_OPTIONS = [
  { value: "week", label: "Неделя" },
  { value: "month", label: "Месяц" },
  { value: "quarter", label: "Квартал" },
  { value: "year", label: "Год" },
];

export function StatsDashboard(p: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const current = sp.get("period") || p.period;

  function setPeriod(v: string) {
    router.push(`/crm/stats?period=${v}`);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Аналитика</h1>
          <p className="text-sm text-muted-fg mt-1">Сводка по заявкам, выручке и клиентам.</p>
        </div>
        <div className="inline-flex rounded-lg border border-border bg-card/40 p-0.5">
          {PERIOD_OPTIONS.map((o) => (
            <button
              key={o.value}
              onClick={() => setPeriod(o.value)}
              className={`px-3 py-1.5 text-xs rounded-md transition ${
                current === o.value ? "bg-primary text-primary-fg" : "text-muted-fg hover:text-fg"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={Banknote} label="Выручка" value={formatRub(p.revenue)} tone="primary" />
        <Kpi icon={Activity} label="Заявок всего" value={String(p.totalRequests)} hint={`${p.doneCount} выполнено`} />
        <Kpi icon={TrendingUp} label="Средний чек" value={formatRub(p.avgCheck)} />
        <Kpi icon={CheckCircle2} label="Конверсия в выполненные" value={`${p.conversion}%`} tone="success" />
        <Kpi icon={RotateCcw} label="Повторных клиентов" value={`${p.repeatRate}%`} hint="≥ 2 заявок" />
        <Kpi icon={Users} label="Уникальных клиентов" value={String(p.topClients.length || Object.keys(p.byStatus).length)} />
        <Kpi icon={CheckCircle2} label="Выполнено" value={String(p.doneCount)} tone="success" />
        <Kpi icon={Activity} label="Отменено" value={String(p.cancelledCount)} tone="muted" />
      </div>

      {/* Bar chart */}
      <div className="card p-5 lg:p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-fg">Выручка по дням</div>
            <div className="text-sm mt-0.5">{formatRub(p.revenue)} за период</div>
          </div>
        </div>
        <RevenueBars items={p.revenueByDay} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Donut by status */}
        <div className="card p-5 lg:p-6">
          <div className="text-xs uppercase tracking-wider text-muted-fg mb-5">Распределение по статусам</div>
          <StatusDonut byStatus={p.byStatus} total={p.totalRequests} />
        </div>

        {/* Top services */}
        <div className="card p-5 lg:p-6">
          <div className="text-xs uppercase tracking-wider text-muted-fg mb-5">Топ услуг по выручке</div>
          {p.topServices.length === 0 ? (
            <Empty />
          ) : (
            <ul className="space-y-2.5">
              {p.topServices.map((s, i) => {
                const max = p.topServices[0].revenue || 1;
                const pct = Math.round((s.revenue / max) * 100);
                return (
                  <li key={s.name}>
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="font-medium truncate">{s.name}</span>
                      <span className="text-muted-fg tabular-nums">{formatRub(s.revenue)} · {s.count} шт.</span>
                    </div>
                    <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.7, delay: i * 0.05 }}
                        className="h-full bg-gradient-to-r from-primary to-accent"
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Top clients */}
      <div className="card p-5 lg:p-6">
        <div className="text-xs uppercase tracking-wider text-muted-fg mb-5">Топ клиентов по выручке</div>
        {p.topClients.length === 0 ? (
          <Empty />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {p.topClients.map((c, i) => (
              <Link key={c.id} href={`/crm/clients/${c.id}`} className="card-interactive p-4 block">
                <div className="flex items-baseline justify-between">
                  <span className="font-mono text-xs text-muted-fg">#{i + 1}</span>
                  <span className="text-xs text-muted-fg">{c.count} зак.</span>
                </div>
                <div className="mt-1 font-medium truncate">{c.name}</div>
                <div className="mt-1 text-sm text-primary tabular-nums">{formatRub(c.revenue)}</div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────

function Kpi({ icon: Icon, label, value, hint, tone }: { icon: any; label: string; value: string; hint?: string; tone?: "primary" | "success" | "muted" }) {
  const toneClasses = {
    primary: "text-primary",
    success: "text-emerald-400",
    muted: "text-muted-fg",
  };
  const valueClr = tone ? toneClasses[tone] : "text-fg";
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wider text-muted-fg">{label}</div>
        <Icon className="h-4 w-4 text-muted-fg" />
      </div>
      <div className={`mt-2 text-2xl font-semibold tabular-nums ${valueClr}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-fg">{hint}</div>}
    </div>
  );
}

function Empty() {
  return <div className="text-sm text-muted-fg text-center py-8">За этот период данных нет</div>;
}

function RevenueBars({ items }: { items: Props["revenueByDay"] }) {
  const max = Math.max(1, ...items.map((i) => i.revenue));
  // Если дней больше 60, не показываем все подписи
  const showLabels = items.length <= 14;
  return (
    <div className="space-y-2">
      <div className="flex items-end gap-1 h-44">
        {items.map((it, i) => {
          const h = (it.revenue / max) * 100;
          return (
            <div key={it.date} className="flex-1 flex flex-col justify-end items-center group relative min-w-0">
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${h}%` }}
                transition={{ duration: 0.5, delay: Math.min(i * 0.01, 0.5) }}
                className={`w-full rounded-t ${it.revenue > 0 ? "bg-gradient-to-t from-primary/60 to-primary" : "bg-muted/30"}`}
                style={{ minHeight: it.revenue > 0 ? 3 : 1 }}
              />
              {it.revenue > 0 && (
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 hidden group-hover:block whitespace-nowrap rounded-md bg-bg-2 border border-border px-2 py-1 text-[10px] z-10">
                  <div className="font-medium">{it.label}</div>
                  <div className="text-primary tabular-nums">{formatRub(it.revenue)}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {showLabels && (
        <div className="flex gap-1">
          {items.map((it) => (
            <div key={it.date} className="flex-1 text-[10px] text-muted-fg text-center truncate min-w-0">{it.label}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusDonut({ byStatus, total }: { byStatus: Record<string, number>; total: number }) {
  const entries = Object.entries(byStatus);
  if (total === 0) return <Empty />;

  let cumulative = 0;
  const segments = entries.map(([status, count]) => {
    const meta = statusMeta(status);
    const start = cumulative;
    cumulative += count;
    return { status, count, meta, start, end: cumulative };
  });

  const radius = 52;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="flex items-center gap-6 flex-wrap">
      <div className="relative">
        <svg width="140" height="140" viewBox="0 0 140 140" className="-rotate-90">
          {segments.map((s) => {
            const startPct = s.start / total;
            const lenPct = s.count / total;
            const dashArray = `${lenPct * circumference} ${circumference}`;
            const dashOffset = -startPct * circumference;
            return (
              <motion.circle
                key={s.status}
                cx="70" cy="70" r={radius}
                fill="none"
                stroke={s.meta.hex}
                strokeWidth="16"
                strokeDasharray={dashArray}
                strokeDashoffset={dashOffset}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4 }}
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-2xl font-semibold tabular-nums">{total}</div>
          <div className="text-[10px] uppercase tracking-wider text-muted-fg">заявок</div>
        </div>
      </div>
      <ul className="flex-1 min-w-[180px] space-y-1.5">
        {segments.map((s) => (
          <li key={s.status} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ background: s.meta.hex }} />
              {s.meta.label}
            </span>
            <span className="font-mono tabular-nums text-muted-fg">
              {s.count} · {Math.round((s.count / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
