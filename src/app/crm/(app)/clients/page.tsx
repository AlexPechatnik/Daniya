import { prisma } from "@/lib/db";
import Link from "next/link";
import { formatRub } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const clients = await prisma.client.findMany({
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { requests: true } }, requests: { select: { price: true, paymentStatus: true } } },
    take: 200,
  });

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">Клиенты</h1>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-fg">
            <tr>
              <th className="text-left px-4 py-2.5">Имя / организация</th>
              <th className="text-left px-4 py-2.5">Телефон</th>
              <th className="text-left px-4 py-2.5">Заявок</th>
              <th className="text-right px-4 py-2.5">Сумма оплачено</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {clients.map((c) => {
              const paid = c.requests.filter((r) => r.paymentStatus === "PAID").reduce((s, r) => s + (r.price || 0), 0);
              return (
                <tr key={c.id} className="hover:bg-muted/30">
                  <td className="px-4 py-2.5"><Link href={`/crm/clients/${c.id}`} className="hover:text-primary">{c.name}</Link>{c.org && <div className="text-xs text-muted-fg">{c.org}</div>}</td>
                  <td className="px-4 py-2.5">{c.phone}</td>
                  <td className="px-4 py-2.5">{c._count.requests}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{formatRub(paid)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
