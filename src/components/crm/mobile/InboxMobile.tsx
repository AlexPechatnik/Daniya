"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { format, isToday, isYesterday, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import {
  ArrowLeft,
  Inbox as InboxIcon,
  Phone,
  Search,
  Send,
  X,
} from "lucide-react";
import { EmptyState } from "../EmptyState";

/**
 * Мобильный инбокс — full-screen список диалогов или конкретный чат.
 * При активном c=clientId — открывается чат с back-стрелкой.
 * Без второго столбца (профиль клиента) и без 3-колоночного desktop-layout.
 */

interface Conversation {
  clientId: string;
  clientName: string;
  clientPhone: string;
  lastText: string;
  lastDirection: "in" | "out";
  lastAt: string | null;
  unread: number;
  providers: string[];
}

interface DialogMsg {
  id: string;
  direction: "in" | "out";
  text: string;
  provider: string;
  createdAt: string;
}

interface DialogPayload {
  client: { id: string; name: string; phone: string; channels: any[] };
  messages: DialogMsg[];
}

const POLL_MS = 7000;

export function InboxMobile({
  initialClientIdPromise,
}: {
  initialClientIdPromise: Promise<string | null>;
}) {
  const initialClientId = use(initialClientIdPromise);
  const router = useRouter();
  const sp = useSearchParams();
  const urlClientId = sp.get("c") || initialClientId;

  if (urlClientId) {
    return <ChatScreen clientId={urlClientId} onBack={() => router.push("/crm/inbox")} />;
  }
  return <ListScreen />;
}

/* ──────────── список диалогов ──────────── */

function ListScreen() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

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
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  const filtered = query.trim()
    ? conversations.filter((c) => {
        const q = query.toLowerCase();
        return (
          c.clientName.toLowerCase().includes(q) ||
          c.clientPhone.includes(q) ||
          c.lastText.toLowerCase().includes(q)
        );
      })
    : conversations;

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Чаты</h1>
        <p className="mt-1 text-sm text-muted-fg">
          Переписка с клиентами по всем каналам.
        </p>
      </div>

      {/* Поиск по диалогам */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-fg" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Имя, телефон или текст…"
          className="input h-11 w-full pl-10 pr-9 text-sm"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-muted-fg hover:bg-muted/40 hover:text-fg"
            aria-label="Очистить поиск"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {loading && conversations.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card px-4 py-10 text-center text-sm text-muted-fg">
          Загружаем диалоги…
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card">
          <EmptyState
            icon={InboxIcon}
            tone="teal"
            title={query ? "Ничего не нашли" : "Сообщений пока нет"}
            hint={
              query
                ? "Попробуйте имя клиента, телефон или часть текста."
                : "Когда клиент напишет в Telegram или MAX, диалог появится здесь."
            }
          />
        </div>
      ) : (
        <ul className="overflow-hidden rounded-2xl border border-border bg-card divide-y divide-border">
          {filtered.map((c) => (
            <li key={c.clientId}>
              <Link
                href={`/crm/inbox?c=${c.clientId}`}
                className="flex items-start gap-3 px-3 py-3 transition active:bg-muted/40"
              >
                <Avatar name={c.clientName} hasUnread={c.unread > 0} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className={`truncate ${c.unread > 0 ? "font-semibold" : "font-medium"}`}>
                      {c.clientName}
                    </span>
                    {c.lastAt && (
                      <span className="shrink-0 text-[11px] text-muted-fg">
                        {formatRelative(c.lastAt)}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex items-baseline justify-between gap-2">
                    <span className={`truncate text-sm ${c.unread > 0 ? "text-fg" : "text-muted-fg"}`}>
                      {c.lastDirection === "out" && <span className="text-muted-fg/70">Вы: </span>}
                      {stripHtml(c.lastText) || "—"}
                    </span>
                    {c.unread > 0 && (
                      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-semibold leading-none text-white">
                        {c.unread}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ──────────── экран чата ──────────── */

function ChatScreen({ clientId, onBack }: { clientId: string; onBack: () => void }) {
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
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [payload?.messages.length]);

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
      <div className="flex h-[60vh] items-center justify-center text-sm text-muted-fg">
        Загружаем…
      </div>
    );
  }

  const hasChannels = (payload.client?.channels?.length ?? 0) > 0;

  return (
    // -mx-4 / -mt-4 — выкидываем встроенные паддинги main, чтобы чат лёг во всю ширину
    <div className="-mx-4 -mt-4 flex h-[calc(100dvh-3.5rem-4rem)] flex-col bg-card lg:hidden">
      {/* Шапка с back, именем и телефоном */}
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-card/95 px-3 py-3 backdrop-blur">
        <button
          type="button"
          onClick={onBack}
          aria-label="Назад к списку"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-primary hover:bg-primary/10"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{payload.client.name}</div>
          <div className="truncate text-xs text-muted-fg">{payload.client.phone}</div>
        </div>
        <a
          href={`tel:${payload.client.phone}`}
          aria-label="Позвонить"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary hover:bg-primary/20"
        >
          <Phone className="h-4 w-4" />
        </a>
      </header>

      {/* Сообщения */}
      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto bg-bg-2/30 px-3 py-3">
        {payload.messages.length === 0 ? (
          <div className="px-2 py-10 text-center text-sm text-muted-fg">
            Сообщений ещё нет. Напишите первым — клиент получит уведомление в мессенджер.
          </div>
        ) : (
          payload.messages.map((m, i) => (
            <Bubble key={m.id} m={m} prev={payload.messages[i - 1]} />
          ))
        )}
      </div>

      {/* Ввод */}
      <div className="border-t border-border bg-card/95 px-3 py-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] backdrop-blur">
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
              rows={2}
              placeholder="Написать клиенту…"
              className="input min-h-[72px] flex-1 resize-none py-2 text-sm leading-relaxed"
              disabled={sending}
            />
            <button
              type="button"
              onClick={send}
              disabled={sending || !text.trim()}
              aria-label="Отправить"
              className="inline-flex h-[72px] w-11 items-center justify-center rounded-xl bg-primary text-primary-fg shadow-sm transition disabled:cursor-not-allowed disabled:opacity-40 hover:opacity-90"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        )}
        {error && <div className="mt-2 text-xs text-red-500">{error}</div>}
      </div>
    </div>
  );
}

/* ──────────── babli, helpers ──────────── */

function Bubble({ m, prev }: { m: DialogMsg; prev?: DialogMsg }) {
  const incoming = m.direction === "in";
  const showTime =
    !prev ||
    Math.abs(parseISO(m.createdAt).getTime() - parseISO(prev.createdAt).getTime()) > 5 * 60 * 1000;
  const cleanText = stripHtml(m.text);
  return (
    <div>
      {showTime && (
        <div className="my-2 text-center text-[10px] uppercase tracking-wider text-muted-fg">
          {formatTimestamp(m.createdAt)} · {m.provider}
        </div>
      )}
      <div className={`flex ${incoming ? "justify-start" : "justify-end"}`}>
        <div
          className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
            incoming ? "bg-card text-fg" : "bg-primary text-primary-fg"
          }`}
        >
          <div className="whitespace-pre-wrap break-words leading-snug">{cleanText}</div>
        </div>
      </div>
    </div>
  );
}

function Avatar({ name, hasUnread }: { name: string; hasUnread: boolean }) {
  const initial = (name || "?").trim().charAt(0).toUpperCase();
  const hue = hashHue(name);
  return (
    <div className="relative shrink-0">
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

function stripHtml(text: string): string {
  if (!text) return "";
  return text
    .replace(/<\/?[a-z][^>]*>/gi, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .trim();
}

function formatRelative(iso: string) {
  const d = parseISO(iso);
  if (isToday(d)) return format(d, "HH:mm");
  if (isYesterday(d)) return "вчера";
  return format(d, "d MMM", { locale: ru });
}

function formatTimestamp(iso: string) {
  const d = parseISO(iso);
  if (isToday(d)) return format(d, "HH:mm");
  if (isYesterday(d)) return `вчера, ${format(d, "HH:mm")}`;
  return format(d, "d MMMM, HH:mm", { locale: ru });
}
