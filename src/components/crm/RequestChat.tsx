"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Send, MessageCircle } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

interface Msg {
  id: string;
  direction: string; // "in" | "out"
  provider: string;
  text: string;
  createdAt: string | Date;
}

/**
 * Чат с клиентом прямо на странице заявки.
 * Показывает всю переписку (входящие + исходящие, любой канал)
 * и позволяет отправить ответ через первый рабочий привязанный мессенджер.
 */
export function RequestChat({
  requestId,
  clientId,
  hasChannels,
  initialMessages,
}: {
  requestId: string;
  clientId: string;
  hasChannels: boolean;
  initialMessages: Msg[];
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<Msg[]>(initialMessages);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  async function send() {
    const value = text.trim();
    if (!value || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, requestId, text: value }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Не удалось отправить");
        return;
      }
      // Оптимистично добавляем сообщение в ленту; полная синхронизация — через router.refresh()
      setMessages((prev) => [
        ...prev,
        {
          id: `tmp-${Date.now()}`,
          direction: "out",
          provider: data.provider || "—",
          text: value,
          createdAt: new Date(),
        },
      ]);
      setText("");
      router.refresh();
    } catch (e: any) {
      setError(e?.message || "Сеть недоступна");
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="rounded-3xl border border-border bg-card p-5 shadow-sm lg:p-6">
      <div className="mb-4 flex items-center gap-2">
        <MessageCircle className="h-5 w-5 text-muted-fg" />
        <div className="font-semibold">История сообщений</div>
        <div className="ml-auto text-xs text-muted-fg">
          {messages.length > 0 ? `${messages.length} сообщений` : ""}
        </div>
      </div>

      <div
        ref={scrollRef}
        className="max-h-[420px] space-y-2 overflow-y-auto rounded-2xl border border-border bg-bg-2 p-3"
      >
        {messages.length === 0 ? (
          <div className="px-2 py-10 text-center text-sm text-muted-fg">
            Переписки пока нет. Напишите клиенту первым — сообщение уйдёт по привязанному мессенджеру.
          </div>
        ) : (
          messages.map((m) => {
            const incoming = m.direction === "in";
            return (
              <div key={m.id} className={`flex ${incoming ? "justify-start" : "justify-end"}`}>
                <div
                  className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-sm shadow-sm ${
                    incoming ? "bg-card text-fg" : "bg-primary text-primary-fg"
                  }`}
                >
                  <div className={`mb-0.5 text-[10px] uppercase tracking-wider ${incoming ? "text-muted-fg" : "text-primary-fg/75"}`}>
                    {m.provider} · {incoming ? "клиент" : "мастер"} ·{" "}
                    {format(new Date(m.createdAt), "d MMM, HH:mm", { locale: ru })}
                  </div>
                  <div className="whitespace-pre-wrap break-words">{m.text}</div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="mt-3">
        {!hasChannels ? (
          <div className="rounded-2xl border border-dashed border-border bg-bg-2 px-4 py-3 text-center text-xs text-muted-fg">
            У клиента нет привязанных мессенджеров — отправка из CRM пока недоступна. Свяжитесь по телефону.
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
              placeholder="Написать клиенту…  (Ctrl+Enter — отправить)"
              className="input min-h-[52px] resize-y py-2"
              disabled={sending}
            />
            <button
              type="button"
              onClick={send}
              disabled={sending || !text.trim()}
              className="btn-primary h-[52px] px-4"
            >
              <Send className="h-4 w-4" />
              {sending ? "Отправка" : "Отправить"}
            </button>
          </div>
        )}
        {error && <div className="mt-2 text-xs text-red-500">{error}</div>}
      </div>
    </section>
  );
}
