import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { RequestEditor } from "@/components/crm/RequestEditor";
import { QuickActionButton } from "@/components/crm/QuickActionButton";
import { StatusBadge } from "@/components/crm/StatusBadge";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const request = await prisma.request.findUnique({
    where: { id },
    include: {
      client: { include: { addresses: true, printers: true } },
      address: true,
      assignedTo: true,
      service: true,
      messages: { orderBy: { createdAt: "asc" }, take: 50 },
    },
  });
  if (!request) notFound();

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

      <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-3 font-semibold">История сообщений</div>
        {request.messages.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-bg-2 px-4 py-8 text-center text-sm text-muted-fg">
            Сообщений пока нет. Здесь появится история общения с клиентом.
          </div>
        ) : (
          <div className="space-y-2">
            {request.messages.map((message) => (
              <div
                key={message.id}
                className={`rounded-2xl p-3 text-sm ${message.direction === "in" ? "bg-muted" : "ml-12 bg-primary/10"}`}
              >
                <div className="mb-0.5 text-xs text-muted-fg">
                  {message.provider} · {message.direction === "in" ? "от клиента" : "ответ"} · {message.createdAt.toLocaleString("ru-RU")}
                </div>
                {message.text}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
