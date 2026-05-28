"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Phone, MapPin, CalendarDays, UserRound, Wrench } from "lucide-react";
import { MobilePageHeader } from "./MobilePageHeader";
import { MobileBottomBar } from "./MobileBottomBar";
import { MobileTabs } from "./MobileTabs";
import { MobileStatusPipeline } from "./MobileStatusPipeline";
import { StatusBadge } from "../StatusBadge";
import { QuickActionButton } from "../QuickActionButton";
import { RequestChat } from "../RequestChat";
import { RequestEditor } from "../RequestEditor";
import { shortenSpbAddress } from "@/lib/address";

/**
 * Мобильная страница заявки в master-стиле:
 *   • sticky-шапка с back + название
 *   • hero-блок «что сейчас» (статус, адрес, время, оплата)
 *   • табы Карточка / Чат / История
 *   • sticky-bar внизу с главным действием (Принять → В пути → ...)
 */
type Tab = "card" | "chat" | "history";

export function RequestPageMobile({
  request,
  services,
  masters,
  messages,
  hasChannels,
}: {
  request: any;
  services: any[];
  masters: any[];
  messages: any[];
  hasChannels: boolean;
}) {
  const [tab, setTab] = useState<Tab>("card");
  const shortAddress = shortenSpbAddress(request.address?.address) || "—";
  const scheduledLabel = request.scheduledAt
    ? format(new Date(request.scheduledAt), "d MMM, HH:mm", { locale: ru })
    : "без времени";
  const mapHref = buildMapHref(shortAddress, request.address?.lat, request.address?.lng);
  const priceRub = request.price ? Math.round(request.price / 100) : 0;

  return (
    <>
      <MobilePageHeader
        backHref="/crm/requests"
        title={`Заявка #${request.number}`}
        subtitle={request.client?.name}
      />

      {/* Hero — статус крупно, ниже краткая инфа */}
      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <StatusBadge status={request.status} size="md" />
          <span className="text-xs text-muted-fg">{request.service?.name || "Без услуги"}</span>
        </div>
        <div className="mt-3">
          <MobileStatusPipeline status={request.status} />
        </div>

        <div className="mt-4 space-y-2.5 text-sm">
          <Row icon={MapPin} tone="red">
            <span className="truncate">{shortAddress}</span>
            {mapHref && (
              <a
                href={mapHref}
                target="_blank"
                rel="noreferrer"
                className="ml-auto shrink-0 text-xs font-medium text-primary"
              >
                Карта →
              </a>
            )}
          </Row>
          <Row icon={CalendarDays} tone="purple">
            <span>{scheduledLabel}</span>
          </Row>
          <Row icon={UserRound} tone="blue">
            <span>{request.assignedTo?.name || "Не назначен"}</span>
          </Row>
          <Row icon={Wrench} tone="orange">
            <span className="truncate">{request.service?.name || "Услуга не выбрана"}</span>
          </Row>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-bg-2/60 px-3 py-2.5">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-fg">Сумма</div>
            <div className="text-xl font-semibold tabular-nums">
              {priceRub.toLocaleString("ru-RU")} <span className="text-muted-fg">₽</span>
            </div>
          </div>
          {request.client?.phone && (
            <a
              href={`tel:${request.client.phone}`}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-medium text-fg shadow-sm"
            >
              <Phone className="h-4 w-4" /> Позвонить
            </a>
          )}
        </div>
      </section>

      {/* Табы */}
      <div className="mt-4">
        <MobileTabs
          tabs={[
            { value: "card", label: "Карточка" },
            { value: "chat", label: "Чат" },
            { value: "history", label: "История" },
          ]}
          value={tab}
          onChange={setTab}
        />
      </div>

      {/* Содержимое таба */}
      <div className="mt-4 pb-32">
        {tab === "card" && (
          <RequestEditor request={request} services={services} masters={masters} />
        )}
        {tab === "chat" && (
          <RequestChat
            requestId={request.id}
            clientId={request.clientId}
            hasChannels={hasChannels}
            initialMessages={messages}
          />
        )}
        {tab === "history" && (
          <HistoryPlaceholder createdAt={request.createdAt} />
        )}
      </div>

      {/* Sticky-bar снизу: основная — «Сохранить и вернуться» (диспатчит
          event для RequestEditor), вторичная — быстрая смена статуса. */}
      <MobileBottomBar>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent("printcare:request:save-and-back"))}
            className="btn-primary h-12 flex-1 text-sm"
          >
            Сохранить и вернуться
          </button>
          <CompactQuickAction requestId={request.id} status={request.status} />
        </div>
      </MobileBottomBar>
    </>
  );
}

function Row({
  icon: Icon,
  tone,
  children,
}: {
  icon: typeof Phone;
  tone: "red" | "orange" | "purple" | "blue";
  children: React.ReactNode;
}) {
  const TONES = {
    red:    "bg-[#FEE2E2] text-[#DC2626]",
    orange: "bg-[#FFEDD5] text-[#EA580C]",
    purple: "bg-[#F3E8FF] text-[#9333EA]",
    blue:   "bg-[#DBEAFE] text-[#2563EB]",
  };
  return (
    <div className="flex items-center gap-3">
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${TONES[tone]}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex min-w-0 flex-1 items-center">{children}</div>
    </div>
  );
}

/** Компактная версия QuickAction — кнопка фиксированной ширины справа от Save. */
function CompactQuickAction({ requestId, status }: { requestId: string; status: string }) {
  return (
    <div className="[&_>div]:w-auto [&_button]:!h-12 [&_button]:!text-sm">
      <QuickActionButton requestId={requestId} status={status} size="md" showCancel={false} />
    </div>
  );
}

function HistoryPlaceholder({ createdAt }: { createdAt: string | Date }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-fg">
      Заявка создана {format(new Date(createdAt), "d MMMM, HH:mm", { locale: ru })}.
      <br />
      Полная история событий будет здесь.
    </div>
  );
}

function buildMapHref(address: string, lat?: number | null, lng?: number | null) {
  if (lat != null && lng != null) return `https://yandex.ru/maps/?rtext=~${lat},${lng}&rtt=auto`;
  if (address) return `https://yandex.ru/maps/?text=${encodeURIComponent(address)}`;
  return "";
}
