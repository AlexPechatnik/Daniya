"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ExternalLink,
  Inbox as InboxIcon,
  MessageCircle,
  Send,
  X,
} from "lucide-react";
import { EmptyState } from "./EmptyState";
import { format, isToday, isYesterday, parseISO } from "date-fns";
import { ru } from "date-fns/locale";

/* ════════════════════════════════════════════════════════════════════════
   Типы и контекст
   ════════════════════════════════════════════════════════════════════════ */

type Conversation = {
  clientId: string;
  clientName: string;
  clientPhone: string;
  lastText: string;
  lastDirection: "in" | "out";
  lastAt: string | null;
  unread: number;
  providers: string[];
};

type DialogMessage = {
  id: string;
  direction: "in" | "out";
  text: string;
  provider: string;
  createdAt: string;
};

type DialogPayload = {
  client: { id: string; name: string; phone: string; channels: any[] };
  messages: DialogMessage[];
};

type ChatSidebarContextValue = {
  open: boolean;
  selectedClientId: string | null;
  unreadTotal: number;
  toggle: () => void;
  openSidebar: () => void;
  close: () => void;
  selectClient: (clientId: string | null) => void;
  /** Уменьшить глобальный счётчик локально (до следующего polling-такта). */
  markRead: (count: number) => void;
};

const ChatSidebarContext = createContext<ChatSidebarContextValue | null>(null);
const STORAGE_KEY = "printcare:chatSidebar";

export function useChatSidebar() {
  const ctx = useContext(ChatSidebarContext);
  if (!ctx) throw new Error("useChatSidebar must be used within <ChatSidebarProvider>");
  return ctx;
}

/* ════════════════════════════════════════════════════════════════════════
   Provider — состояние, persistence, polling счётчика
   ════════════════════════════════════════════════════════════════════════ */

export function ChatSidebarProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [selectedClientId, setSelected] = useState<string | null>(null);
  const [unreadTotal, setUnreadTotal] = useState(0);

  // Восстановление из localStorage. Делаем после маунта, чтобы не было SSR-mismatch.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw) as { open?: boolean; clientId?: string | null };
        if (data.open) setOpen(true);
        if (data.clientId) setSelected(data.clientId);
      }
    } catch {}
  }, []);

  // Persistence
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ open, clientId: selectedClientId }));
    } catch {}
  }, [open, selectedClientId]);

  // Polling счётчика. Ритм: 30s закрыта, 7s открыта.
  useEffect(() => {
    // На /crm/login не дёргаем — там нет авторизации.
    if (pathname?.startsWith("/crm/login")) return;
    let cancelled = false;
    async function tick() {
      try {
        const res = await fetch("/api/inbox/unread", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setUnreadTotal(data.total || 0);
      } catch {}
    }
    tick();
    const interval = setInterval(tick, open ? 7000 : 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [open, pathname]);

  // ESC — закрыть; Ctrl/Cmd+/ — переключить.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "/") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const value: ChatSidebarContextValue = {
    open,
    selectedClientId,
    unreadTotal,
    toggle: () => setOpen((v) => !v),
    openSidebar: () => setOpen(true),
    close: () => setOpen(false),
    selectClient: setSelected,
    markRead: (count) => setUnreadTotal((t) => Math.max(0, t - count)),
  };

  return (
    <ChatSidebarContext.Provider value={value}>
      {children}
    </ChatSidebarContext.Provider>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   ChatSidebar — floating-кнопка и slide-over панель
   ════════════════════════════════════════════════════════════════════════ */

export function ChatSidebar() {
  const pathname = usePathname();
  const { open, selectedClientId, unreadTotal, toggle, close, selectClient } = useChatSidebar();
  // На странице логина чат не нужен.
  if (pathname?.startsWith("/crm/login")) return null;

  return (
    <>
      <FloatingTrigger open={open} unread={unreadTotal} onClick={toggle} />
      <Panel
        open={open}
        selectedClientId={selectedClientId}
        onClose={close}
        onSelectClient={selectClient}
      />
    </>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   Floating button (свёрнутое состояние)
   ════════════════════════════════════════════════════════════════════════ */

function FloatingTrigger({
  open,
  unread,
  onClick,
}: {
  open: boolean;
  unread: number;
  onClick: () => void;
}) {
  const [bump, setBump] = useState(false);
  const prevUnread = useRef(unread);

  // Bounce при росте счётчика
  useEffect(() => {
    if (unread > prevUnread.current) {
      setBump(true);
      const t = setTimeout(() => setBump(false), 420);
      return () => clearTimeout(t);
    }
    prevUnread.current = unread;
  }, [unread]);

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={open ? "Закрыть чаты" : "Открыть чаты"}
      aria-expanded={open}
      aria-keyshortcuts="Control+/"
      // Mobile: 84px (выше bottom-nav и safe-area). Desktop: 20px (обычный отступ).
      className={`fixed bottom-[calc(env(safe-area-inset-bottom)+5.25rem)] right-5 z-40 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-fg shadow-lg shadow-primary/30 ring-1 ring-primary/20 transition-all hover:scale-105 hover:shadow-xl motion-reduce:transition-none motion-reduce:hover:scale-100 lg:bottom-5 ${
        open ? "translate-x-[calc(-1*var(--chat-panel-w,400px))] sm:translate-x-[-400px]" : ""
      } ${bump ? "animate-chat-bump" : ""}`}
    >
      <MessageCircle className="h-6 w-6" />
      {unread > 0 && (
        <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-semibold leading-none text-white shadow-sm">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </button>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   Главная панель — рендерит список или конкретный чат
   ════════════════════════════════════════════════════════════════════════ */

function Panel({
  open,
  selectedClientId,
  onClose,
  onSelectClient,
}: {
  open: boolean;
  selectedClientId: string | null;
  onClose: () => void;
  onSelectClient: (id: string | null) => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Focus-trap: при открытии — на панель; при закрытии — возвращаем на body.
  useEffect(() => {
    if (open && panelRef.current) {
      const focusable = panelRef.current.querySelector<HTMLElement>(
        'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])',
      );
      focusable?.focus();
    }
  }, [open, selectedClientId]);

  return (
    <aside
      ref={panelRef}
      role="dialog"
      aria-modal="false"
      aria-label="Чаты с клиентами"
      aria-hidden={!open}
      // pointer-events-none + invisible когда закрыта — iOS Safari иначе цепляет
      // её за viewport (она fixed right-0 w-full + translate-x-full) и позволяет
      // горизонтальный скролл на странице.
      className={`fixed inset-y-0 right-0 z-30 flex w-full flex-col border-l border-border bg-card/95 shadow-2xl shadow-black/20 backdrop-blur-md transition-transform duration-200 ease-out motion-reduce:transition-none sm:w-[400px] ${
        open
          ? "translate-x-0"
          : "pointer-events-none invisible translate-x-full"
      }`}
    >
      {selectedClientId ? (
        <ChatView clientId={selectedClientId} onBack={() => onSelectClient(null)} onClose={onClose} />
      ) : (
        <ConversationList onSelectClient={onSelectClient} onClose={onClose} />
      )}
    </aside>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   Список диалогов
   ════════════════════════════════════════════════════════════════════════ */

function ConversationList({
  onSelectClient,
  onClose,
}: {
  onSelectClient: (id: string) => void;
  onClose: () => void;
}) {
  const { markRead } = useChatSidebar();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/inbox", { cache: "no-store" });
      const data = await res.json();
      setConversations(data.conversations || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 10_000);
    return () => clearInterval(t);
  }, [load]);

  return (
    <>
      <header className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-border bg-card/95 px-4 py-3 backdrop-blur">
        <h2 className="text-base font-semibold">Чаты</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Закрыть"
          className="rounded-full p-1.5 text-muted-fg hover:bg-muted/40 hover:text-fg"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto">
        {loading && conversations.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-fg">Загружаем диалоги…</div>
        ) : conversations.length === 0 ? (
          <EmptyState
            icon={InboxIcon}
            tone="teal"
            title="Сообщений пока нет"
            hint="Когда клиент напишет в Telegram или MAX, диалог появится здесь."
          />
        ) : (
          <ul className="divide-y divide-border">
            {conversations.map((c) => (
              <li key={c.clientId}>
                <button
                  type="button"
                  onClick={() => {
                    // Оптимистично обнуляем счётчик у этого клиента —
                    // сервер пометит как прочитанные в GET /api/inbox/[clientId].
                    setConversations((prev) =>
                      prev.map((x) => (x.clientId === c.clientId ? { ...x, unread: 0 } : x)),
                    );
                    if (c.unread > 0) markRead(c.unread);
                    onSelectClient(c.clientId);
                  }}
                  className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-muted/30"
                >
                  <Avatar name={c.clientName} hasUnread={c.unread > 0} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className={`truncate ${c.unread > 0 ? "font-semibold" : "font-medium"}`}>
                        {c.clientName}
                      </span>
                      {c.lastAt && (
                        <span className="shrink-0 text-[11px] text-muted-fg">
                          {formatRelativeTime(c.lastAt)}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex items-baseline justify-between gap-2">
                      <span className={`truncate text-sm ${c.unread > 0 ? "text-fg" : "text-muted-fg"}`}>
                        {c.lastDirection === "out" && <span className="text-muted-fg/70">Вы: </span>}
                        {stripHtmlTags(c.lastText) || "—"}
                      </span>
                      {c.unread > 0 && (
                        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-semibold leading-none text-white">
                          {c.unread}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <footer className="border-t border-border bg-card/95 px-4 py-3 text-xs">
        <Link
          href="/crm/inbox"
          onClick={onClose}
          className="inline-flex items-center gap-1.5 text-muted-fg hover:text-fg"
        >
          <ExternalLink className="h-3.5 w-3.5" /> Открыть полностью
        </Link>
      </footer>
    </>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   Просмотр конкретного диалога + отправка
   ════════════════════════════════════════════════════════════════════════ */

function ChatView({
  clientId,
  onBack,
  onClose,
}: {
  clientId: string;
  onBack: () => void;
  onClose: () => void;
}) {
  const [payload, setPayload] = useState<DialogPayload | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/inbox/${clientId}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setPayload(data);
    } catch {}
  }, [clientId]);

  useEffect(() => {
    load();
    const t = setInterval(load, 7000);
    return () => clearInterval(t);
  }, [load]);

  // Auto-scroll вниз при новых сообщениях
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [payload?.messages.length]);

  const hasChannels = useMemo(() => (payload?.client?.channels?.length ?? 0) > 0, [payload]);

  async function send() {
    const value = text.trim();
    if (!value || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, text: value }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Не удалось отправить");
        return;
      }
      setText("");
      await load();
      router.refresh();
    } catch (e: any) {
      setError(e?.message || "Сеть недоступна");
    } finally {
      setSending(false);
    }
  }

  if (!payload) {
    return (
      <>
        <ChatHeader title="…" onBack={onBack} onClose={onClose} />
        <div className="flex-1 p-6 text-center text-sm text-muted-fg">Загружаем…</div>
      </>
    );
  }

  return (
    <>
      <ChatHeader
        title={payload.client.name}
        subtitle={payload.client.phone}
        onBack={onBack}
        onClose={onClose}
      />

      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto bg-bg-2/30 p-3">
        {payload.messages.length === 0 ? (
          <div className="px-2 py-10 text-center text-sm text-muted-fg">
            Сообщений ещё нет. Напишите первым — клиент получит уведомление в мессенджер.
          </div>
        ) : (
          payload.messages.map((m, i) => <Bubble key={m.id} m={m} prev={payload.messages[i - 1]} />)
        )}
      </div>

      <div className="border-t border-border bg-card/95 p-3 backdrop-blur">
        {!hasChannels ? (
          <div className="rounded-lg border border-dashed border-border px-3 py-2 text-center text-xs text-muted-fg">
            У клиента нет привязанных мессенджеров — свяжитесь по телефону.
          </div>
        ) : (
          <div className="flex items-end gap-2">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={3}
              placeholder="Написать клиенту… (Ctrl+Enter — отправить)"
              className="input min-h-[88px] flex-1 resize-y py-2 text-sm leading-relaxed"
              disabled={sending}
            />
            <button
              type="button"
              onClick={send}
              disabled={sending || !text.trim()}
              aria-label="Отправить"
              className="inline-flex h-[88px] w-11 items-center justify-center rounded-xl bg-primary text-primary-fg shadow-sm transition disabled:cursor-not-allowed disabled:opacity-40 hover:opacity-90"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        )}
        {error && <div className="mt-2 text-xs text-red-500">{error}</div>}
      </div>
    </>
  );
}

function ChatHeader({
  title,
  subtitle,
  onBack,
  onClose,
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
  onClose: () => void;
}) {
  return (
    <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-card/95 px-3 py-3 backdrop-blur">
      <button
        type="button"
        onClick={onBack}
        aria-label="Назад к списку чатов"
        className="rounded-full p-1.5 text-muted-fg hover:bg-muted/40 hover:text-fg"
      >
        <ArrowLeft className="h-4 w-4" />
      </button>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">{title}</div>
        {subtitle && <div className="truncate text-xs text-muted-fg">{subtitle}</div>}
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Закрыть"
        className="rounded-full p-1.5 text-muted-fg hover:bg-muted/40 hover:text-fg"
      >
        <X className="h-4 w-4" />
      </button>
    </header>
  );
}

function Bubble({ m, prev }: { m: DialogMessage; prev?: DialogMessage }) {
  const incoming = m.direction === "in";
  const showTime =
    !prev ||
    Math.abs(parseISO(m.createdAt).getTime() - parseISO(prev.createdAt).getTime()) > 5 * 60 * 1000;
  // Чистим Telegram-разметку (<b>, <i>, <code>, &lt; и т.п.) — у нас бот шлёт
  // её для parse_mode: HTML, и в логе клиент-видит её сырыми тегами.
  const cleanText = stripHtmlTags(m.text);
  return (
    <div>
      {showTime && (
        <div className="my-2 text-center text-[10px] uppercase tracking-wider text-muted-fg">
          {formatTimeStamp(m.createdAt)} · {m.provider}
        </div>
      )}
      <div className={`flex ${incoming ? "justify-start" : "justify-end"}`}>
        <div
          className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
            incoming
              ? "bg-card text-fg"
              : "bg-primary text-primary-fg"
          }`}
        >
          <div className="whitespace-pre-wrap break-words leading-snug">{cleanText}</div>
        </div>
      </div>
    </div>
  );
}

function stripHtmlTags(text: string): string {
  if (!text) return "";
  return text
    .replace(/<\/?[a-z][^>]*>/gi, "") // <b>, </b>, <i>, <code>, <a href=...>, …
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .trim();
}

/* ════════════════════════════════════════════════════════════════════════
   Мелочи: аватар, форматирование времени
   ════════════════════════════════════════════════════════════════════════ */

function Avatar({ name, hasUnread }: { name: string; hasUnread: boolean }) {
  const initial = (name || "?").trim().charAt(0).toUpperCase();
  const hue = hashHue(name);
  return (
    <div className="relative">
      <div
        className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-white"
        style={{ background: `hsl(${hue}, 60%, 45%)` }}
        aria-hidden
      >
        {initial}
      </div>
      {hasUnread && (
        <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-card bg-red-500" />
      )}
    </div>
  );
}

function hashHue(str: string) {
  let h = 0;
  for (let i = 0; i < (str || "").length; i++) h = (h * 31 + str.charCodeAt(i)) % 360;
  return h;
}

function formatRelativeTime(iso: string) {
  const d = parseISO(iso);
  if (isToday(d)) return format(d, "HH:mm");
  if (isYesterday(d)) return "вчера";
  return format(d, "d MMM", { locale: ru });
}

function formatTimeStamp(iso: string) {
  const d = parseISO(iso);
  if (isToday(d)) return format(d, "HH:mm");
  if (isYesterday(d)) return `вчера, ${format(d, "HH:mm")}`;
  return format(d, "d MMMM, HH:mm", { locale: ru });
}
