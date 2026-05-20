import type { Metadata } from "next";
import { Reveal } from "@/components/Reveal";
import { MapPin, Phone, Mail, Clock } from "lucide-react";
import { company } from "@/lib/company";

export const metadata: Metadata = {
  title: "О компании и контакты",
  description: "PrintCare — выездной сервис принтеров и картриджей в Санкт-Петербурге. Адрес офиса в Мурино, телефон, контакты.",
};

export default function Page() {
  return (
    <>
      <section className="container py-16 lg:py-24 max-w-3xl">
        <Reveal>
          <h1 className="heading-display text-4xl md:text-5xl lg:text-6xl">О компании</h1>
        </Reveal>
        <div className="mt-10 space-y-6 text-lg text-fg/85 leading-relaxed">
          <p>PrintCare — выездной сервис принтеров и картриджей в Санкт-Петербурге. Узкая специализация: только печатная техника, никакого «всё подряд».</p>
          <p>Мы приезжаем в офис или домой со всем необходимым оборудованием и расходниками. Большинство задач решается на месте за 20–40 минут. Если нужна полноценная сервисная чистка картриджа — заберём в наш сервис в Мурино или привезём подмену, чтобы вы не ждали.</p>
          <p>Работаем с физическими лицами и организациями: для бизнеса — договор, закрывающие документы и единая точка ответственности по всему парку техники.</p>
        </div>
      </section>

      <section className="container pb-20 lg:pb-28">
        <Reveal>
          <h2 className="heading-display text-3xl md:text-4xl">Контакты</h2>
        </Reveal>
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <ContactCard icon={MapPin} title="Адрес офиса">
            <div>{company.address}</div>
            <div className="text-xs text-muted-fg mt-1">Ленинградская область, рядом со СПб</div>
          </ContactCard>
          <ContactCard icon={Phone} title="Телефон" link={`tel:${company.phoneTel}`}>{company.phone}</ContactCard>
          <ContactCard icon={Mail} title="Email" link={`mailto:${company.email}`}>{company.email}</ContactCard>
          <ContactCard icon={Clock} title="Время работы">
            <div>Пн–Пт 9:00 — 20:00</div>
            <div>Сб 10:00 — 18:00</div>
            <div className="text-xs text-muted-fg mt-1">Выездные заявки — по согласованию</div>
          </ContactCard>
        </div>
      </section>
    </>
  );
}

function ContactCard({ icon: Icon, title, link, children }: { icon: any; title: string; link?: string; children: React.ReactNode }) {
  const body = (
    <>
      <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-4">
        <Icon className="h-4 w-4" />
      </div>
      <div className="text-xs uppercase tracking-wider text-muted-fg mb-2">{title}</div>
      <div className="text-sm leading-relaxed">{children}</div>
    </>
  );
  if (link) {
    return <a href={link} className="card-interactive p-6 block">{body}</a>;
  }
  return <div className="card p-6">{body}</div>;
}
