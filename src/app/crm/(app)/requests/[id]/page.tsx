import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { RequestEditor } from "@/components/crm/RequestEditor";
import { RequestChat } from "@/components/crm/RequestChat";
import { QuickActionButton } from "@/components/crm/QuickActionButton";
import { StatusBadge } from "@/components/crm/StatusBadge";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const request = await prisma.request.findUnique({
    where: { id },
    include: {
      client: { include: { addresses: true, printers: true, channels: true } },
      address: true,
      assignedTo: true,
      service: true,
    },
  });
  if (!request) notFound();

  // Полная переписка с этим клиентом по всем каналам и заявкам — чат на странице
  // должен быть осмысленной хронологической лентой, а не только логом из ботов.
  const messages = await prisma.message.findMany({
    where: { clientId: request.clientId },
    orderBy: { createdAt: "asc" },
    take: 200,
  });
  // Открыли заявку → считаем входящие прочитанными, чтобы счётчик в инбоксе обнулился.
  await prisma.message.updateMany({
    where: { clientId: request.clientId, direction: "in", unread: true },
    data: { unread: false },
  });

  const services = await prisma.service.findMany({ orderBy: { name: "asc" } });
  const masters = await prisma.user.findMany({ where: { active: true }, orderBy: { name: "asc" } });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/crm/requests" className="text-sm font-medium text-muted-fg hover:text-fg">← К заявкам</Link>
          <div className="mt-2 flex flex-wrap items-baseline gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">Заявка #{request.number}</h1>
            <StatusBadge status={request.status} size="lg" />
          </div>
        </div>
        <QuickActionButton
          requestId={request.id}
          status={request.status}
          size="lg"
          showCancel={request.status !== "CANCELLED" && request.status !== "DONE"}
        />
      </div>

      <RequestEditor request={request as any} services={services} masters={masters} />

      {/* Чат шире не должен быть редактора — кладём в ту же grid-сетку, что и RequestEditor */}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr),340px]">
        <RequestChat
          requestId={request.id}
          clientId={request.clientId}
          hasChannels={request.client.channels.length > 0}
          initialMessages={messages.map((m) => ({
            id: m.id,
            direction: m.direction,
            provider: m.provider,
            text: m.text,
            createdAt: m.createdAt.toISOString(),
          }))}
        />
        <div className="hidden xl:block" />
      </div>
    </div>
  );
}
