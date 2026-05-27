"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Search, X, Phone, FileSearch, UserCog, LayoutDashboard, LogOut } from "lucide-react";

/**
 * Топ-бар CRM: динамический заголовок раздела + ⌘K-поиск + аватар админа.
 * Заменяет голое слово «CRM» — даёт быструю навигацию и приватность.
 */
const SECTION_TITLES: { match: RegExp; title: string }[] = [
  { match: /^\/crm\/requests\/[^/]+$/, title: "Заявка" },
  { match: /^\/crm\/requests/, title: "Заявки" },
  { match: /^\/crm\/inbox/, title: "Чаты" },
  { match: /^\/crm\/calendar/, title: "План выездов" },
  { match: /^\/crm\/clients/, title: "Клиенты" },
  { match: /^\/crm\/money/, title: "Деньги" },
  { match: /^\/crm\/stats/, title: "Отчёты" },
  { match: /^\/crm\/history/, title: "История" },
  { match: /^\/crm\/price/, title: "Прайс" },
  { match: /^\/crm\/settings\/bot/, title: "Боты" },
  { match: /^\/crm\/settings\/schedule/, title: "График" },
  { match: /^\/crm\/settings\/holidays/, title: "Нерабочие дни" },
  { match: /^\/crm\/more/, title: "Ещё" },
  { match: /^\/crm$/, title: "Рабочий стол" },
];

function sectionTitle(pathname: string): string {
  return SECTION_TITLES.find((s) => s.match.test(pathname))?.title || "CRM";
}

export function CrmTopBar({ userName, userRole }: { userName: string; userRole?: string }) {
  const pathname = usePathname() || "/crm";
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Закрытие меню при клике вне
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  const isMasterView = pathname.startsWith("/crm/mobile");
  const isAdmin = userRole === "ADMIN";

  // ⌘K / Ctrl+K — открыть поиск
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const initial = (userName || "?").trim().charAt(0).toUpperCase();

  return (
    <>
      <div className="flex items-center gap-2 text-sm">
        <span className="hidden font-medium text-fg lg:inline">{sectionTitle(pathname)}</span>
      </div>

      <div className="flex items-center gap-2">
        {/* ⌘K — поиск по клиентам/заявкам */}
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="hidden h-9 items-center gap-2 rounded-full border border-border bg-bg-2/60 px-3 text-sm text-muted-fg transition hover:border-primary/40 hover:text-fg md:inline-flex"
          aria-label="Поиск (Ctrl+K)"
        >
          <Search className="h-4 w-4" />
          <span>Поиск</span>
          <kbd className="ml-2 hidden rounded bg-card px-1.5 py-0.5 text-[10px] font-mono text-muted-fg ring-1 ring-border xl:inline">
            Ctrl K
          </kbd>
        </button>
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-bg-2/60 text-muted-fg transition hover:border-primary/40 hover:text-fg md:hidden"
          aria-label="Поиск"
        >
          <Search className="h-4 w-4" />
        </button>

        {/* Аватар с меню — переключатель режима + выход */}
        <div ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label={`Меню профиля: ${userName}`}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary transition hover:bg-primary/25"
            title={userName}
          >
            {initial}
          </button>
          {menuOpen && (
            // fixed позиция — стабильно у правого края экрана, не зависит
            // от ширины родительского flex-контейнера.
            <div
              role="menu"
              className="fixed right-3 top-14 z-50 w-60 overflow-hidden rounded-2xl border border-border bg-card shadow-xl"
            >
              <div className="border-b border-border px-4 py-3">
                <div className="text-sm font-medium">{userName}</div>
                <div className="text-xs text-muted-fg">
                  {isAdmin ? "Администратор" : "Мастер"}
                  {isMasterView && isAdmin && " · режим мастера"}
                </div>
              </div>

              {isAdmin && (
                isMasterView ? (
                  <Link
                    href="/crm"
                    onClick={() => setMenuOpen(false)}
                    role="menuitem"
                    className="flex items-center gap-3 px-4 py-3 text-sm transition hover:bg-muted/40"
                  >
                    <LayoutDashboard className="h-4 w-4 text-primary" />
                    Вернуться в админ
                  </Link>
                ) : (
                  <Link
                    href="/crm/mobile?tab=mine"
                    onClick={() => setMenuOpen(false)}
                    role="menuitem"
                    className="flex items-center gap-3 px-4 py-3 text-sm transition hover:bg-muted/40"
                  >
                    <UserCog className="h-4 w-4 text-primary" />
                    Открыть как мастер
                  </Link>
                )
              )}

              <form action="/api/auth/logout" method="POST" className="border-t border-border">
                <button
                  type="submit"
                  role="menuitem"
                  className="flex w-full items-center gap-3 px-4 py-3 text-sm text-muted-fg transition hover:bg-muted/40 hover:text-fg"
                >
                  <LogOut className="h-4 w-4" />
                  Выйти
                </button>
              </form>
            </div>
          )}
        </div>
      </div>

      {searchOpen && <GlobalSearchPortal onClose={() => setSearchOpen(false)} />}
    </>
  );
}

/**
 * Портал модалки в document.body. Иначе `position: fixed` подбирается
 * к ближайшему предку с backdrop-filter (наш header) и центрируется не в окне,
 * а внутри шапки — модалка выглядит «съехавшей».
 */
function GlobalSearchPortal({ onClose }: { onClose: () => void }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(<GlobalSearch onClose={onClose} />, document.body);
}

/* ─── Global search modal ─────────────────────────────────────────────── */

type ClientHit = {
  id: string;
  name: string;
  phone: string;
  org?: string | null;
  lastRequestId?: string | null;
};

function GlobalSearch({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [clients, setClients] = useState<ClientHit[]>([]);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setClients([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/clients/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setClients(data.clients || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => search(query), 200);
    return () => clearTimeout(t);
  }, [query, search]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Распознаём запросы вида «#7» — это переход на заявку по номеру
  const numberMatch = query.trim().match(/^#?(\d+)$/);

  function pickClient(c: ClientHit) {
    router.push(`/crm/clients/${c.id}`);
    onClose();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Поиск по CRM"
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/55 px-4 pt-[12vh] backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-2xl bg-card shadow-2xl ring-1 ring-border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Search className="h-5 w-5 text-muted-fg" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Имя, телефон или #номер заявки"
            className="w-full bg-transparent text-base outline-none placeholder:text-muted-fg/80"
          />
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-muted-fg hover:bg-muted/40 hover:text-fg"
            aria-label="Закрыть"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {numberMatch && (
            <button
              type="button"
              onClick={() => {
                router.push(`/crm/requests?number=${numberMatch[1]}`);
                onClose();
              }}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-muted/30"
            >
              <FileSearch className="h-4 w-4 text-primary" />
              <span className="text-sm">Открыть заявку <span className="font-semibold">#{numberMatch[1]}</span></span>
            </button>
          )}

          {loading && clients.length === 0 && query.length >= 2 && (
            <div className="px-4 py-6 text-center text-sm text-muted-fg">Ищем…</div>
          )}

          {!loading && query.length >= 2 && clients.length === 0 && !numberMatch && (
            <div className="px-4 py-8 text-center text-sm text-muted-fg">
              Ничего не нашли. Попробуйте имя, телефон или номер заявки.
            </div>
          )}

          {clients.length > 0 && (
            <ul className="divide-y divide-border">
              {clients.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => pickClient(c)}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-muted/30"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
                      {(c.name || "?").charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{c.name}</div>
                      <div className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-fg">
                        <Phone className="h-3 w-3" /> {c.phone}
                        {c.org && <span className="ml-2 truncate">· {c.org}</span>}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {query.length < 2 && !numberMatch && (
            <div className="px-4 py-8 text-center text-xs text-muted-fg">
              Начните печатать имя клиента, телефон или <span className="font-mono">#номер</span> заявки.
              <div className="mt-2">Esc — закрыть.</div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border px-4 py-2 text-[11px] text-muted-fg">
          <span>Поиск по клиентам и заявкам</span>
          <span>
            <Link href="/crm/clients" onClick={onClose} className="hover:text-fg">все клиенты</Link>
          </span>
        </div>
      </div>
    </div>
  );
}
