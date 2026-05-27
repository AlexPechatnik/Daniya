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
import { prisma } from "@/lib/db";

export default async function CrmLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [services, masters] = await Promise.all([
    prisma.service.findMany({ orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  const isAdmin = user.role === "ADMIN";
  // Считаем непрочитанные сообщения для бейджа в навигации
  const unreadInbox = await prisma.message.count({
    where: { direction: "in", unread: true },
  });

  const adminNav = [
    { href: "/crm", icon: LayoutDashboard, label: "Рабочий стол" },
    { href: "/crm/requests", icon: ListChecks, label: "Заявки" },
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

      <div className="flex flex-col min-h-screen">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-border bg-card/85 px-4 backdrop-blur lg:px-6">
          <div className="flex items-center gap-3">
            <div className="lg:hidden"><Logo compact /></div>
            <CrmTopBar userName={user.name} userRole={user.role} />
          </div>
          {isAdmin && <QuickAddTrigger services={services} masters={masters} variant="header" />}
        </header>

        <main className="flex-1 overflow-auto px-4 py-4 pb-24 lg:px-6 lg:py-6 lg:pb-6">
          <div className="mx-auto w-full max-w-[1440px]">
            {children}
          </div>
        </main>

        {/* Нижняя навигация для мобильного */}
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t border-border bg-card/95 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]">
          <div className="grid grid-cols-5">
            {mobileNav.map((n) => (
              <Link key={n.href} href={n.href} className="flex flex-col items-center gap-1 py-2.5 text-[10px] text-muted-fg hover:text-fg">
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
    </div>
    </ChatSidebarProvider>
  );
}
