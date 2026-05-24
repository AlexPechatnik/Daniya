"use client";
import { useEffect, useRef, useState, use } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { formatDistanceToNowStrict, format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import { Search, Send, Phone, MessageCircle, Plus, ChevronLeft, RefreshCw, MapPin } from "lucide-react";
import { formatRub } from "@/lib/utils";
import { StatusBadge } from "./StatusBadge";

interface Conversation {
  clientId: string;
  clientName: string;
  clientPhone: string;
  lastText: string;
  lastDirection: "in" | "out";
  lastProvider: string | null;
  lastAt: string | null;
  unread: number;
  totalMessages: number;
  providers: string[];
}

interface ClientDetail {
  id: string;
  name: string;
  org: string | null;
  phone: string;
  email: string | null;
  notes: string | null;
  addresses: { id: string; address: string; district: string | null }[];
  channels: { provider: string; externalId: string }[];
  recentRequests: {
    id: string;
    number: number;
    status: string;
    serviceName: string | null;
    scheduledAt: string | null;
    price: number | null;
  }[];
}

interface Msg {
  id: string;
  direction: "in" | "out";
  text: string;
  provider: string;
  createdAt: string;
  requestId: string | null;
}

const POLL_MS = 7000;

export function InboxView({ initialClientIdPromise }: { initialClientIdPromise: Promise<string | null> }) {
  const initialClientId = use(initialClientIdPromise);
  const router = useRouter();
  const sp = useSearchParams();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeClientId, setActiveClientId] = useState<string | null>(initialClientId);
  const [client, setClient] = useState<ClientDetail | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Загрузка списка диалогов
  async function loadConversations() {
    try {
      const res = await fetch("/api/inbox", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations || []);
      }
    } catch {}
  }

  // Загрузка диалога
  async function loadDialog(id: string) {
    try {
      const res = await fetch(`/api/inbox/${id}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setClient(data.client);
        setMessages(data.messages);
      }
    } catch {}
  }

  // Polling — обновляем список и активный диалог раз в 7 сек
  useEffect(() => {
    loadConversations();
    const t = setInterval(() => {
      loadConversations();
      if (activeClientId) loadDialog(activeClientId);
    }, POLL_MS);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeClientId]);

  // При смене активного клиента — загружаем диалог
  useEffect(() => {
    if (activeClientId) {
      loadDialog(activeClientId);
      const url = new URL(window.location.href);
      url.searchParams.set("c", activeClientId);
      window.history.replaceState({}, "", url);
    } else {
      setClient(null);
      setMessages([]);
    }
  }, [activeClientId]);

  // Прокрутка вниз при новых сообщениях
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function send() {
    if (!input.trim() || !activeClientId || sending) return;
    setSending(true);
    setError("");
    const text = input.trim();
    setInput("");
    const res = await fetch("/api/messages/send", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ clientId: activeClientId, text }),
    });
    setSending(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Не удалось отправить");
      setInput(text);
      return;
    }
    await loadDialog(activeClientId);
    await loadConversations();
  }

  const filtered = conversations.filter((c) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return c.clientName.toLowerCase().includes(q) || c.clientPhone.includes(q.replace(/\D/g, ""));
  });

  return (
    <div className="grid lg:grid-cols-[320px,1fr,300px] gap-4 h-[calc(100vh-7rem)]">
      {/* Левая колонка — список диалогов */}
      <aside className={`card overflow-hidden flex flex-col ${activeClientId ? "hidden lg:flex" : "flex"}`}>
        <div className="p-3 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Входящие</h2>
            <button
              onClick={() => { loadConversations(); if (activeClientId) loadDialog(activeClientId); }}
              className="btn-ghost p-1.5"
              title="Обновить"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-fg" />
            <input
              className="input h-9 pl-9 text-sm"
              placeholder="Поиск по имени/телефону"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 && (
            <div className="text-center text-sm text-muted-fg py-12 px-4">
              {query ? "Ничего не найдено" : "Пока нет сообщений от клиентов"}
            </div>
          )}
          {filtered.map((conv) => (
            <button
              key={conv.clientId}
              onClick={() => setActiveClientId(conv.clientId)}
              className={`w-full text-left px-3 py-3 border-b border-border transition ${
                conv.clientId === activeClientId
                  ? "bg-primary/10"
                  : "hover:bg-muted/30"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="font-medium text-sm truncate">{conv.clientName}</div>
                {conv.lastAt && (
                  <div className="text-[10px] text-muted-fg shrink-0">
                    {formatDistanceToNowStrict(parseISO(conv.lastAt), { locale: ru })}
                  </div>
                )}
              </div>
              <div className="mt-1 flex items-start justify-between gap-2">
                <div className="text-xs text-muted-fg truncate flex-1">
                  {conv.lastDirection === "out" && <span className="text-fg/60">Вы: </span>}
                  {conv.lastText.slice(0, 60)}
                </div>
                {conv.unread > 0 && (
                  <div className="bg-primary text-primary-fg text-[10px] font-mono rounded-full px-1.5 min-w-[18px] text-center tabular-nums">
                    {conv.unread}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      </aside>

      {/* Центральная колонка — чат */}
      <main className={`card flex flex-col overflow-hidden ${activeClientId ? "flex" : "hidden lg:flex"}`}>
        {!activeClientId && (
          <div className="flex-1 flex items-center justify-center text-muted-fg text-sm flex-col gap-2 p-8">
            <MessageCircle className="h-10 w-10 opacity-40" />
            <div>Выберите диалог слева</div>
          </div>
        )}
        {activeClientId && client && (
          <>
            <div className="p-3 border-b border-border flex items-center gap-2">
              <button
                onClick={() => setActiveClientId(null)}
                className="lg:hidden btn-ghost p-1.5"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="min-w-0 flex-1">
                <Link href={`/crm/clients/${client.id}`} className="font-semibold truncate hover:text-primary block">
                  {client.name}
                </Link>
                <div className="text-xs text-muted-fg truncate">
                  {client.phone}
                  {client.channels.length > 0 && (
                    <> · {client.channels.map((c) => c.provider).join(" + ")}</>
                  )}
                </div>
              </div>
              <a href={`tel:${client.phone}`} className="btn-ghost p-2" title="Позвонить">
                <Phone className="h-4 w-4" />
              </a>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-bg/30">
              {messages.length === 0 && (
                <div className="text-center text-xs text-muted-fg py-8">Сообщений пока нет</div>
              )}
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex ${m.direction === "out" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap ${
                      m.direction === "out"
                        ? "bg-primary text-primary-fg rounded-br-sm"
                        : "bg-card border border-border rounded-bl-sm"
                    }`}
                  >
                    <div>{m.text}</div>
                    <div
                      className={`mt-1 text-right text-[10px] ${
                        m.direction === "out" ? "text-white/90" : "text-slate-500"
                      }`}
                    >
                      {format(parseISO(m.createdAt), "HH:mm")} · {m.provider}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            <div className="p-3 border-t border-border">
              {error && <div className="text-xs text-danger mb-2">{error}</div>}
              <div className="flex gap-2">
                <input
                  className="input flex-1"
                  placeholder="Написать ответ…"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  disabled={sending}
                />
                <button
                  onClick={send}
                  disabled={!input.trim() || sending}
                  className="btn-primary px-4"
                  title="Отправить (Enter)"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
              <div className="text-[10px] text-muted-fg mt-1.5">
                Ответ уйдёт клиенту через {client.channels[0]?.provider || "первый доступный канал"}
              </div>
            </div>
          </>
        )}
      </main>

      {/* Правая колонка — контекст клиента */}
      {client && (
        <aside className="hidden lg:flex card flex-col overflow-y-auto">
          <div className="p-4 border-b border-border">
            <div className="text-xs uppercase tracking-wider text-muted-fg">Клиент</div>
            <Link href={`/crm/clients/${client.id}`} className="block mt-1 font-semibold hover:text-primary">
              {client.name}
            </Link>
            {client.org && <div className="text-xs text-muted-fg mt-0.5">{client.org}</div>}
            <button
              onClick={() => {
                window.dispatchEvent(
                  new CustomEvent("printcare:quickadd", { detail: { clientId: client.id, phone: client.phone } }),
                );
              }}
              className="btn-primary btn-glow w-full mt-4 text-sm"
            >
              <Plus className="h-3.5 w-3.5" /> Создать заявку
            </button>
          </div>

          {client.addresses.length > 0 && (
            <div className="p-4 border-b border-border">
              <div className="text-xs uppercase tracking-wider text-muted-fg mb-2">Адреса</div>
              <ul className="space-y-1.5 text-xs">
                {client.addresses.map((a) => (
                  <li key={a.id} className="flex items-start gap-1.5">
                    <MapPin className="h-3 w-3 text-muted-fg shrink-0 mt-0.5" />
                    <span>{a.address}{a.district && <span className="text-muted-fg"> · {a.district}</span>}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {client.recentRequests.length > 0 && (
            <div className="p-4 flex-1">
              <div className="text-xs uppercase tracking-wider text-muted-fg mb-2">Последние заявки</div>
              <ul className="space-y-2">
                {client.recentRequests.map((r) => (
                  <li key={r.id}>
                    <Link
                      href={`/crm/requests/${r.id}`}
                      className="block rounded-lg border border-border bg-bg/40 p-2.5 hover:bg-muted/30 transition"
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-mono text-xs text-muted-fg">#{r.number}</span>
                        <StatusBadge status={r.status} size="sm" />
                      </div>
                      <div className="text-xs mt-1 truncate">{r.serviceName || "—"}</div>
                      {r.scheduledAt && (
                        <div className="text-[10px] text-muted-fg mt-0.5">
                          {format(parseISO(r.scheduledAt), "d MMM, HH:mm", { locale: ru })}
                        </div>
                      )}
                      {r.price && (
                        <div className="text-[10px] text-muted-fg tabular-nums mt-0.5">{formatRub(r.price)}</div>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      )}
    </div>
  );
}
