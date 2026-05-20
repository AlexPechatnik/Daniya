import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { Logo } from "@/components/Logo";
import { Sun, ListChecks, Users, Calendar, FileSpreadsheet, LogOut, LayoutGrid, BarChart3, History, CalendarOff, Bot } from "lucide-react";
import { QuickAddTrigger } from "@/components/crm/QuickAddTrigger";
import { prisma } from "@/lib/db";

export default async function CrmLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [services, masters] = await Promise.all([
    prisma.service.findMany({ orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  const nav = [
    { href: "/crm", icon: Sun, label: "Сегодня" },
    { href: "/crm/board", icon: LayoutGrid, label: "Доска" },
    { href: "/crm/calendar", icon: Calendar, label: "Календарь" },
    { href: "/crm/requests", icon: ListChecks, label: "Все заявки" },
    { href: "/crm/stats", icon: BarChart3, label: "Аналитика" },
    { href: "/crm/history", icon: History, label: "История" },
    { href: "/crm/clients", icon: Users, label: "Клиенты" },
    { href: "/crm/price", icon: FileSpreadsheet, label: "Прайс" },
    { href: "/crm/settings/holidays", icon: CalendarOff, label: "Нерабочие дни" },
    { href: "/crm/settings/bot", icon: Bot, label: "Боты" },
  ];

  return (
    <div className="min-h-screen grid lg:grid-cols-[240px,1fr]">
      <aside className="hidden lg:flex border-r border-border bg-card/30 flex-col">
        <div className="px-5 py-4 border-b border-border"><Logo /></div>
        <nav className="p-3 space-y-1">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm hover:bg-muted transition">
              <n.icon className="h-4 w-4 text-muted-fg" /> {n.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto p-3 border-t border-border">
          <div className="px-3 py-2 text-sm">
            <div className="font-medium">{user.name}</div>
            <div className="text-xs text-muted-fg">{user.role === "ADMIN" ? "Администратор" : "Мастер"}</div>
          </div>
          <form action="/api/auth/logout" method="POST">
            <button className="btn-ghost w-full justify-start text-sm" type="submit">
              <LogOut className="h-4 w-4" /> Выйти
            </button>
          </form>
        </div>
      </aside>

      <div className="flex flex-col min-h-screen">
        <header className="h-14 border-b border-border bg-bg/70 backdrop-blur flex items-center justify-between px-4 lg:px-6 sticky top-0 z-30">
          <div className="lg:hidden"><Logo compact /></div>
          <div className="hidden lg:block text-sm text-muted-fg">CRM</div>
          <QuickAddTrigger services={services} masters={masters} variant="header" />
        </header>

        <main className="p-4 lg:p-6 flex-1 overflow-auto pb-24 lg:pb-6">{children}</main>

        {/* Нижняя навигация для мобильного */}
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t border-border bg-bg/95 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]">
          <div className="grid grid-cols-5">
            {[
              { href: "/crm", icon: Sun, label: "Сегодня" },
              { href: "/crm/board", icon: LayoutGrid, label: "Доска" },
              { href: "/crm/calendar", icon: Calendar, label: "Календарь" },
              { href: "/crm/stats", icon: BarChart3, label: "Аналитика" },
              { href: "/crm/clients", icon: Users, label: "Клиенты" },
            ].map((n) => (
              <Link key={n.href} href={n.href} className="flex flex-col items-center gap-1 py-2.5 text-[10px] text-muted-fg hover:text-fg">
                <n.icon className="h-5 w-5" />
                {n.label}
              </Link>
            ))}
          </div>
        </nav>
      </div>

      {/* Плавающая «+» — на мобильном поверх всего */}
      <QuickAddTrigger services={services} masters={masters} variant="fab" />
    </div>
  );
}
