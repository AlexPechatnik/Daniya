import Link from "next/link";
import { BarChart3, Bot, CalendarOff, Clock, FileSpreadsheet, History, LayoutGrid, Users } from "lucide-react";

export const dynamic = "force-dynamic";

const items = [
  { href: "/crm/clients", icon: Users, title: "Клиенты", text: "Карточки клиентов, адреса и история заявок." },
  { href: "/crm/stats", icon: BarChart3, title: "Отчёты", text: "Показатели, конверсия, услуги и клиенты." },
  { href: "/crm/history", icon: History, title: "История", text: "Архив закрытых заявок и событий." },
  { href: "/crm/price", icon: FileSpreadsheet, title: "Прайс", text: "Услуги, картриджи и цены." },
  { href: "/crm/settings/schedule", icon: Clock, title: "График", text: "Рабочие часы и длительность визитов." },
  { href: "/crm/settings/holidays", icon: CalendarOff, title: "Нерабочие дни", text: "Выходные, отпуска и исключения." },
  { href: "/crm/settings/bot", icon: Bot, title: "Боты", text: "Telegram, Max, роли и уведомления." },
  { href: "/crm/board", icon: LayoutGrid, title: "Доска статусов", text: "Дополнительный обзор заявок по статусам." },
];

export default function MorePage() {
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Ещё</h1>
        <p className="mt-1 text-sm text-muted-fg">Второстепенные разделы, чтобы основная CRM не превращалась в длинный список.</p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <Link key={item.href} href={item.href} className="rounded-2xl border border-border bg-card/45 p-4 transition hover:bg-card">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
                <item.icon className="h-5 w-5" />
              </div>
              <div>
                <div className="font-semibold">{item.title}</div>
                <div className="mt-1 text-sm leading-relaxed text-muted-fg">{item.text}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
