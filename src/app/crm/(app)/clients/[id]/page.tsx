import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { formatRub } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      addresses: true,
      printers: true,
      requests: { orderBy: { createdAt: "desc" }, include: { service: true, assignedTo: true } },
      channels: true,
    },
  });
  if (!client) notFound();

  return (
    <div className="space-y-5">
      <Link href="/crm/clients" className="text-sm text-muted-fg hover:text-fg">← К клиентам</Link>
      <div className="grid gap-5 lg:grid-cols-[1fr,360px]">
        <div className="space-y-5">
          <div className="card p-5">
            <h1 className="text-2xl font-semibold">{client.name}</h1>
            {client.org && <div className="text-muted-fg">{client.org}</div>}
            <div className="mt-3 grid sm:grid-cols-2 gap-2 text-sm">
              <div><span className="text-muted-fg">Телефон:</span> {client.phone}</div>
              {client.email && <div><span className="text-muted-fg">Email:</span> {client.email}</div>}
              {client.channels.map((ch) => (
                <div key={ch.id}><span className="text-muted-fg">{ch.provider}:</span> {ch.externalId}</div>
              ))}
            </div>
            {client.notes && <div className="mt-3 text-sm text-muted-fg">{client.notes}</div>}
          </div>

          <div className="card overflow-hidden">
            <div className="px-5 py-3 border-b font-semibold">История заявок ({client.requests.length})</div>
            <table className="w-full text-sm">
              <thead className="bg-muted/20 text-xs uppercase tracking-wider text-muted-fg">
                <tr>
                  <th className="text-left px-4 py-2">#</th>
                  <th className="text-left px-4 py-2">Услуга</th>
                  <th className="text-left px-4 py-2">Дата</th>
                  <th className="text-left px-4 py-2">Статус</th>
                  <th className="text-right px-4 py-2">Сумма</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {client.requests.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/20">
                    <td className="px-4 py-2 tabular-nums">{r.number}</td>
                    <td className="px-4 py-2"><Link href={`/crm/requests/${r.id}`} className="hover:text-primary">{r.service?.name || "—"}</Link></td>
                    <td className="px-4 py-2">{r.scheduledAt?.toLocaleString("ru-RU", { day: "2-digit", month: "short" }) || r.createdAt.toLocaleDateString("ru-RU")}</td>
                    <td className="px-4 py-2 text-muted-fg">{r.status}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{formatRub(r.price)}</td>
                  </tr>
                ))}
                {client.requests.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-fg">Заявок пока нет</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="card p-5">
            <div className="font-semibold mb-2">Адреса</div>
            {client.addresses.length === 0 && <div className="text-sm text-muted-fg">Не указаны</div>}
            <ul className="space-y-1.5 text-sm">
              {client.addresses.map((a) => <li key={a.id}>{a.label && <span className="text-muted-fg">{a.label}: </span>}{a.address}</li>)}
            </ul>
          </div>
          <div className="card p-5">
            <div className="font-semibold mb-2">Принтеры</div>
            {client.printers.length === 0 && <div className="text-sm text-muted-fg">Не добавлены</div>}
            <ul className="space-y-1.5 text-sm">
              {client.printers.map((p) => <li key={p.id}>{p.brand} {p.model}</li>)}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
