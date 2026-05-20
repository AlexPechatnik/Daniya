import { prisma } from "@/lib/db";
import { KanbanBoard } from "@/components/crm/KanbanBoard";

export const dynamic = "force-dynamic";

export default async function BoardPage() {
  const requests = await prisma.request.findMany({
    where: { status: { not: "CANCELLED" } },
    include: { client: true, service: true, address: true },
    orderBy: [{ scheduledAt: "asc" }, { createdAt: "desc" }],
    take: 300,
  });

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Доска заявок</h1>
          <p className="text-sm text-muted-fg mt-1">Перетаскивайте заявки между колонками — статус меняется автоматически.</p>
        </div>
      </div>
      <KanbanBoard
        requests={requests.map((r) => ({
          id: r.id,
          number: r.number,
          clientName: r.client.name,
          clientPhone: r.client.phone,
          serviceName: r.service?.name || "—",
          printerInfo: r.printerInfo,
          address: r.address?.address || "",
          scheduledAt: r.scheduledAt?.toISOString() || null,
          status: r.status,
          price: r.price,
        }))}
      />
    </div>
  );
}
