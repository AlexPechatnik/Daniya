import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { Logo } from "@/components/Logo";
import {
  ListChecks,
  Users,
  Calendar,
  LogOut,
  History,
  CheckCircle2,
  Play,
  UserCircle,
  WalletCards,
  MoreHorizontal,
  LayoutDashboard,
  Inbox,
} from "lucide-react";
import { QuickAddTrigger } from "@/components/crm/QuickAddTrigger";
import { ChatSidebar, ChatSidebarProvider } from "@/components/crm/ChatSidebar";
import { CrmTopBar } from "@/components/crm/CrmTopBar";
import { CrmHeaderLogo } from "@/components/crm/CrmHeaderLogo";
import { NewRequestNotifier } from "@/components/crm/NewRequestNotifier";
import { prisma } from "@/lib/db";

export default async function CrmLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [services, masters] = await Promise.all([
    prisma.service.findMany({ orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  const isAdmin = user.role === "ADMIN";
  // Считаем непрочитанные сообщения и новые клиентские заявки — для бейджей.
  const [unreadInbox, newRequestsCount] = await Promise.all([
    prisma.message.count({ where: { direction: "in", unread: true } }),
    prisma.request.count({
      where: {
        status: "NEW",
        source: { in: ["TELEGRAM", "MAX", "WEB"] },
      },
    }),
  ]);

  const adminNav = [
    { href: "/crm", icon: LayoutDashboard, label: "Рабочий стол" },
    { href: "/crm/requests", icon: ListChecks, label: "Заявки", badge: newRequestsCount || null },
    { href: "/crm/inbox", icon: Inbox, label: "Чаты", badge: unreadInbox || null },
    { href: "/crm/calendar", icon: Calendar, label: "План выездов" },
    { href: "/crm/clients", icon: Users, label: "Клиенты" },
    { href: "/crm/money", icon: WalletCards, label: "Деньги" },
    { href: "/crm/more", icon: MoreHorizontal, label: "Ещё" },
  ];
  const masterNav = [
    { href: "/crm/mobile?tab=new", icon: ListChecks, label: "Новые" },
    { href: "/crm/mobile?tab=mine", icon: CheckCircle2, label: "Мои" },
    { href: "/crm/mobile?tab=active", icon: Play, label: "Сейчас" },
    { href: "/crm/mobile?tab=done", icon: History, label: "Готово" },
    { href: "/crm/mobile?tab=profile", icon: UserCircle, label: "Профиль" },
  ];
  const mobileNav = isAdmin
    ? [
        { href: "/crm", icon: LayoutDashboard, label: "Стол" },
        { href: "/crm/requests", icon: ListChecks, label: "Заявки" },
        { href: "/crm/calendar", icon: Calendar, label: "План" },
        { href: "/crm/money", icon: WalletCards, label: "Деньги" },
        { href: "/crm/more", icon: MoreHorizontal, label: "Ещё" },
      ]
    : masterNav;

  return (
    <ChatSidebarProvider>
    {/* overflow-x-clip — чтобы скрытая (translate-x-full) панель чата справа
        не давала прокручивать страницу вправо и не показывала тёмный фон body.
        bg-bg — чтобы за пределами карточек был светлый фон CRM, а не тёмный градиент body. */}
    <div className="crm-light min-h-screen grid lg:grid-cols-[240px,1fr] overflow-x-clip bg-bg text-fg">
      <aside className="hidden lg:flex border-r border-border bg-card flex-col">
        <div className="px-5 py-4 border-b border-border"><Logo /></div>
        <nav className="p-3 space-y-1">
          {isAdmin ? (
            adminNav.map((n) => (
              <Link key={n.href} href={n.href} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm hover:bg-muted transition">
                <n.icon className="h-4 w-4 text-muted-fg" />
                <span className="flex-1">{n.label}</span>
                {(n as any).badge && (
                  <span className="bg-primary text-primary-fg text-[10px] font-mono rounded-full px-1.5 py-0.5 tabular-nums">
                    {(n as any).badge}
                  </span>
                )}
              </Link>
            ))
          ) : (
            masterNav.map((n) => (
              <Link key={n.href} href={n.href} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm hover:bg-muted transition">
                <n.icon className="h-4 w-4 text-muted-fg" /> {n.label}
              </Link>
            ))
          )}
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

      {/* min-w-0 — grid-/flex-item должен мочь сжиматься уже своего содержимого,
          иначе горизонтальные скроллы (фильтры/таблицы) растягивают всю CRM. */}
      <div className="flex flex-col min-h-screen min-w-0">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-border bg-card/85 px-4 backdrop-blur lg:px-6">
          <div className="flex items-center gap-3">
            {/* Лого в CRM-шапке — не уводит на лендинг, а переключает
                админ↔мастер (см. CrmHeaderLogo). На десктопе lg+ лого уже
                в боковом сайдбаре, тут показываем только на узких. */}
            <div className="lg:hidden"><CrmHeaderLogo userRole={user.role} /></div>
            <CrmTopBar userName={user.name} userRole={user.role} />
          </div>
          {isAdmin && <QuickAddTrigger services={services} masters={masters} variant="header" />}
        </header>

        {/* Раньше каппали max-w-1440 — это было ок для большинства страниц,
            но мешало страницам с правым drawer (заявки): drawer фиксирован
            справа в viewport, а контент висел в каппе по центру, между ними
            оставалась мёртвая зона. Теперь cap не на уровне layout —
            страница ставит свой cap сама, когда он нужен. */}
        <main className="flex-1 overflow-auto px-4 py-4 pb-24 lg:px-6 lg:py-6 lg:pb-6">
          <div className="w-full">
            {children}
          </div>
        </main>

        {/* Нижняя навигация для мобильного.
            safe-area-padding едет на каждую ссылку (а не на <nav>) — чтобы
            зона тапа доходила до низа экрана (палец чаще промахивается вниз).
            min-h-[58px] = Apple HIG минимум 44pt + воздух. touch-manipulation
            убирает 300ms-задержку iOS на double-tap zoom. active:bg-muted —
            тактильный feedback, чтобы пользователь видел, что попал. */}
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t border-border bg-card/95 backdrop-blur-xl">
          <div className="grid grid-cols-5">
            {mobileNav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="flex min-h-[58px] touch-manipulation flex-col items-center justify-center gap-1 px-1 pt-2.5 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] text-[10px] text-muted-fg transition active:bg-muted/40 active:text-fg hover:text-fg"
              >
                <n.icon className="h-5 w-5" />
                {n.label}
              </Link>
            ))}
          </div>
        </nav>
      </div>

      {/* Плавающая «+» — на мобильном поверх всего */}
      {isAdmin && <QuickAddTrigger services={services} masters={masters} variant="fab" />}

      {/* Чаты — слайд-панель справа + floating-кнопка с бейджем */}
      <ChatSidebar />

      {/* Уведомления о новых клиентских заявках — toast + звон + browser-notif */}
      <NewRequestNotifier />
    </div>
    </ChatSidebarProvider>
  );
}
