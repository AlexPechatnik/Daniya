"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, X, Phone } from "lucide-react";

/**
 * Поллер новых клиентских заявок (Telegram/MAX/Web).
 *
 *   • Каждые 15s GET /api/requests/incoming?since=<lastSeen>
 *   • Новые → стек toast'ов справа-снизу, мягкий звук, browser-Notification
 *     (с разрешением), обновляется favicon/badge можно потом.
 *   • lastSeen хранится в localStorage — после рестарта вкладки не повторяет
 *     прошлые нотификации.
 *
 * Намеренно без сторонних toast-либ — один файл, никаких зависимостей.
 */

type IncomingRequest = {
  id: string;
  number: number;
  clientName: string;
  clientPhone: string;
  serviceName: string;
  source: string;
  createdAt: string;
};

const STORAGE_KEY = "printcare:newRequests:lastSeen";
const POLL_INTERVAL_MS = 15_000;

export function NewRequestNotifier() {
  const pathname = usePathname();
  const [toasts, setToasts] = useState<IncomingRequest[]>([]);
  // lastSeen инициализируем лениво на первом tick — useRef в отличие от
  // useState не принимает init-функцию, делать в render нельзя (SSR).
  const lastSeenRef = useRef<string | null>(null);

  // Запрашиваем разрешение на браузер-нотификации один раз, мягко.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) return;
    if (Notification.permission === "default") {
      // Не дёргаем prompt сразу — иначе при первом заходе сразу всплывает
      // системный диалог, что бесит. Спросим при первом нашем toast'е.
    }
  }, []);

  const playPing = useCallback(() => {
    try {
      const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      // Два коротких тона: «динь-дон», как у Slack/Telegram
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
      // Закрытие контекста через паузу — иначе iOS Safari копит AudioContext
      setTimeout(() => ctx.close().catch(() => {}), 800);
    } catch {}
  }, []);

  const showBrowserNotif = useCallback((r: IncomingRequest) => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) return;
    if (Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
      return;
    }
    if (Notification.permission !== "granted") return;
    try {
      const n = new Notification(`Новая заявка #${r.number}`, {
        body: `${r.clientName} · ${r.serviceName}`,
        tag: `req-${r.id}`,
        icon: "/favicon.ico",
      });
      n.onclick = () => {
        window.focus();
        window.location.href = `/crm/requests/${r.id}`;
      };
      // Закрываем через 8s, чтобы не висели стопками
      setTimeout(() => n.close(), 8000);
    } catch {}
  }, []);

  // Polling
  useEffect(() => {
    if (pathname?.startsWith("/crm/login")) return;
    let cancelled = false;

    async function tick() {
      try {
        // Первый запуск: подтянуть lastSeen из localStorage, иначе
        // взять текущее время (стартуем «с нуля», без бэклога).
        if (lastSeenRef.current == null) {
          try {
            lastSeenRef.current = localStorage.getItem(STORAGE_KEY) || new Date().toISOString();
          } catch {
            lastSeenRef.current = new Date().toISOString();
          }
        }
        const since = lastSeenRef.current;
        const res = await fetch(`/api/requests/incoming?since=${encodeURIComponent(since)}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data: { requests: IncomingRequest[]; serverTime: string } = await res.json();
        if (cancelled) return;
        // Обновляем lastSeen на serverTime — берём время сервера, чтобы не
        // ловить рассинхрон с клиентскими часами.
        lastSeenRef.current = data.serverTime;
        try { localStorage.setItem(STORAGE_KEY, data.serverTime); } catch {}

        if (data.requests.length > 0) {
          setToasts((prev) => {
            // дедупликация на случай гонок
            const seen = new Set(prev.map((t) => t.id));
            const fresh = data.requests.filter((r) => !seen.has(r.id));
            return [...fresh, ...prev].slice(0, 5);
          });
          playPing();
          data.requests.forEach(showBrowserNotif);
        }
      } catch {}
    }
    tick();
    const interval = setInterval(tick, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [pathname, playPing, showBrowserNotif]);

  // Авто-снятие через 12s каждого toast'а
  useEffect(() => {
    if (toasts.length === 0) return;
    const timers = toasts.map((t) =>
      setTimeout(() => {
        setToasts((prev) => prev.filter((x) => x.id !== t.id));
      }, 12_000),
    );
    return () => timers.forEach(clearTimeout);
  }, [toasts]);

  function dismiss(id: string) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-end gap-2 px-3 pb-[calc(env(safe-area-inset-bottom)+5rem)] lg:px-5 lg:pb-5">
      {toasts.map((r) => (
        <div
          key={r.id}
          role="status"
          className="pointer-events-auto w-full max-w-sm overflow-hidden rounded-2xl border border-primary/30 bg-card shadow-2xl shadow-primary/10 ring-1 ring-primary/10 animate-fade-up"
        >
          <Link
            href={`/crm/requests/${r.id}`}
            onClick={() => dismiss(r.id)}
            className="flex items-start gap-3 px-4 py-3.5 transition hover:bg-primary/[0.04]"
          >
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Bell className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-semibold text-fg">Новая заявка #{r.number}</span>
                <span className="text-[10px] uppercase tracking-wider text-muted-fg">{sourceLabel(r.source)}</span>
              </div>
              <div className="mt-0.5 truncate text-sm text-fg">{r.clientName}</div>
              <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-fg">
                <Phone className="h-3 w-3" />
                <span>{r.clientPhone}</span>
                <span aria-hidden>·</span>
                <span className="truncate">{r.serviceName}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                dismiss(r.id);
              }}
              aria-label="Закрыть уведомление"
              className="rounded-full p-1 text-muted-fg transition hover:bg-muted/40 hover:text-fg"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </Link>
        </div>
      ))}
    </div>
  );
}

function sourceLabel(src: string): string {
  if (src === "TELEGRAM") return "Telegram";
  if (src === "MAX") return "MAX";
  if (src === "WEB") return "Сайт";
  return src;
}
