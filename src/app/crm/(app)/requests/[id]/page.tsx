import { prisma } from "@/lib/db";
import { formatRub } from "@/lib/utils";
import { notFound } from "next/navigation";
import Link from "next/link";
import { RequestEditor } from "@/components/crm/RequestEditor";
import { StatusPipeline } from "@/components/crm/StatusPipeline";
import { QuickActionButton } from "@/components/crm/QuickActionButton";
import { StatusBadge } from "@/components/crm/StatusBadge";
import { Phone, MapPin, User, Calendar as CalIcon } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

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

  const services = await prisma.service.findMany();
  const masters = await prisma.user.findMany({ where: { active: true } });

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <Link href="/crm/requests" className="text-sm text-muted-fg hover:text-fg">← К заявкам</Link>
          <div className="flex items-baseline gap-3 mt-2 flex-wrap">
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

      <StatusPipeline status={request.status} />

      <div className="grid gap-5 lg:grid-cols-[1fr,360px]">
        <div className="space-y-5">
          <RequestEditor request={request as any} services={services} masters={masters} />

          <div className="card p-5">
            <div className="font-semibold mb-3">История сообщений</div>
            {request.messages.length === 0 && <div className="text-sm text-muted-fg">Сообщений пока нет.</div>}
            <div className="space-y-2">
              {request.messages.map((m) => (
                <div key={m.id} className={`rounded-lg p-3 text-sm ${m.direction === "in" ? "bg-muted/50" : "bg-primary/10 ml-12"}`}>
                  <div className="text-xs text-muted-fg mb-0.5">{m.provider} · {m.direction === "in" ? "от клиента" : "ответ"} · {m.createdAt.toLocaleString("ru-RU")}</div>
                  {m.text}
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="card p-5">
            <div className="text-xs uppercase tracking-wider text-muted-fg flex items-center gap-1.5">
              <User className="h-3 w-3" /> Клиент
            </div>
            <Link href={`/crm/clients/${request.client.id}`} className="block mt-2 font-semibold hover:text-primary">{request.client.name}</Link>
            <a href={`tel:${request.client.phone}`} className="flex items-center gap-1.5 text-sm mt-1 text-muted-fg hover:text-fg">
              <Phone className="h-3.5 w-3.5" /> {request.client.phone}
            </a>
            {request.client.email && <div className="text-sm text-muted-fg mt-0.5">{request.client.email}</div>}
          </div>

          {request.address && (
            <div className="card p-5">
              <div className="text-xs uppercase tracking-wider text-muted-fg flex items-center gap-1.5">
                <MapPin className="h-3 w-3" /> Адрес
              </div>
              <div className="mt-2 text-sm">{request.address.address}</div>
            </div>
          )}

          {request.scheduledAt && (
            <div className="card p-5">
              <div className="text-xs uppercase tracking-wider text-muted-fg flex items-center gap-1.5">
                <CalIcon className="h-3 w-3" /> Время выезда
              </div>
              <div className="mt-2 text-sm">{format(request.scheduledAt, "d MMMM, EEEE · HH:mm", { locale: ru })}</div>
              <div className="text-xs text-muted-fg mt-0.5">Длительность: {request.durationMin} мин</div>
            </div>
          )}

          <div className="card p-5">
            <div className="text-xs uppercase tracking-wider text-muted-fg">Стоимость</div>
            <div className="mt-2 text-2xl font-semibold tabular-nums">{formatRub(request.price)}</div>
            <div className="text-xs text-muted-fg mt-1">
              Оплата: {request.paymentStatus === "PAID" ? "оплачено" : request.paymentStatus === "PARTIAL" ? "частично" : "не оплачено"}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
