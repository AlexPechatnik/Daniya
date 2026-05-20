import { prisma } from "@/lib/db";
import { formatRub } from "@/lib/utils";
import Link from "next/link";
import { StatusBadge } from "@/components/crm/StatusBadge";
import { QuickActionButton } from "@/components/crm/QuickActionButton";

export const dynamic = "force-dynamic";

const statusOptions = [
  { value: "", label: "Все" },
  { value: "NEW", label: "Новые" },
  { value: "SCHEDULED", label: "Запланированы" },
  { value: "EN_ROUTE", label: "В пути" },
  { value: "IN_PROGRESS", label: "В работе" },
  { value: "AWAITING_PAYMENT", label: "Ожидают оплаты" },
  { value: "DONE", label: "Выполнены" },
  { value: "CANCELLED", label: "Отменены" },
];

export default async function RequestsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const requests = await prisma.request.findMany({
    where: status ? { status } : undefined,
    orderBy: [{ scheduledAt: "asc" }, { createdAt: "desc" }],
    include: { client: true, assignedTo: true, service: true, address: true },
    take: 200,
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Заявки</h1>
      </div>

      <div className="flex flex-wrap gap-2 overflow-x-auto">
        {statusOptions.map((o) => (
          <Link key={o.value} href={`/crm/requests${o.value ? `?status=${o.value}` : ""}`}
            className={`px-3 py-1.5 rounded-lg border text-sm whitespace-nowrap transition ${
              status === o.value || (!status && !o.value)
                ? "bg-primary text-primary-fg border-primary"
                : "bg-card/40 hover:bg-card border-border"
            }`}>
            {o.label}
          </Link>
        ))}
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-fg">
            <tr>
              <th className="text-left px-4 py-2.5">#</th>
              <th className="text-left px-4 py-2.5">Клиент</th>
              <th className="text-left px-4 py-2.5">Услуга</th>
              <th className="text-left px-4 py-2.5">Адрес</th>
              <th className="text-left px-4 py-2.5">Когда</th>
              <th className="text-left px-4 py-2.5">Мастер</th>
              <th className="text-left px-4 py-2.5">Статус</th>
              <th className="text-right px-4 py-2.5">Сумма</th>
              <th className="text-right px-4 py-2.5">Действие</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {requests.map((r) => (
              <tr key={r.id} className="hover:bg-muted/20 transition">
                <td className="px-4 py-2.5 tabular-nums text-muted-fg font-mono">{r.number}</td>
                <td className="px-4 py-2.5">
                  <Link href={`/crm/requests/${r.id}`} className="hover:text-primary font-medium">{r.client.name}</Link>
                  <div className="text-xs text-muted-fg">{r.client.phone}</div>
                </td>
                <td className="px-4 py-2.5">{r.service?.name || <span className="text-muted-fg">—</span>}</td>
                <td className="px-4 py-2.5 text-muted-fg max-w-[180px] truncate">{r.address?.address || "—"}</td>
                <td className="px-4 py-2.5">
                  {r.scheduledAt
                    ? r.scheduledAt.toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
                    : <span className="text-muted-fg">—</span>}
                </td>
                <td className="px-4 py-2.5">{r.assignedTo?.name || <span className="text-muted-fg">не назначен</span>}</td>
                <td className="px-4 py-2.5"><StatusBadge status={r.status} size="sm" /></td>
                <td className="px-4 py-2.5 text-right tabular-nums">{formatRub(r.price)}</td>
                <td className="px-4 py-2.5 text-right">
                  <QuickActionButton requestId={r.id} status={r.status} size="sm" />
                </td>
              </tr>
            ))}
            {requests.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-10 text-center text-muted-fg">Нет заявок</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
