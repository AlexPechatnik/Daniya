import Link from "next/link";
import { MessageCircle, Phone, Send, Clock, MapPin } from "lucide-react";
import { Reveal, RevealStagger, RevealItem } from "./Reveal";
import { publicBotLinks } from "@/lib/publicBotLinks";
import { company } from "@/lib/company";

export function ContactChannels() {
  const bots = publicBotLinks();
  // Если ни одного бота не настроено — секцию вообще не показываем,
  // чтобы не получился пустой блок «Связаться» только с телефоном.
  if (bots.length === 0) return null;

  return (
    <section className="relative py-20 lg:py-28 overflow-hidden">
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-grid mask-fade-edges opacity-30" />
        <div className="absolute -top-32 right-1/4 h-[420px] w-[420px] bg-primary/15 blur-[120px] rounded-full animate-float-slow" />
      </div>
      <div className="container relative">
        <Reveal>
          <div className="flex items-end justify-between gap-6 flex-wrap mb-10">
            <div>
              <div className="chip mb-4"><span className="font-mono text-primary">06</span> Связаться</div>
              <h2 className="heading-display text-4xl md:text-5xl lg:text-6xl max-w-3xl">
                Напишите там,<br /><span className="text-gradient">где вам удобно</span>
              </h2>
            </div>
            <p className="text-muted-fg max-w-md leading-relaxed">
              Один и тот же бот — заявка, статус, чат с мастером. Не любите писать в боты — позвоните или оставьте номер на форме.
            </p>
          </div>
        </Reveal>

        <RevealStagger className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Telegram / Max — динамические */}
          {bots.map((bot) => (
            <RevealItem key={bot.key}>
              <a
                href={bot.href}
                target="_blank"
                rel="noreferrer"
                className="card-interactive p-6 h-full block group relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative">
                  <div className="h-12 w-12 rounded-xl flex items-center justify-center border border-primary/30 bg-primary/15 text-primary mb-5">
                    {bot.key === "telegram" ? <TelegramIcon /> : <MaxIcon />}
                  </div>
                  <div className="text-lg font-semibold tracking-tight">{bot.label}</div>
                  <div className="mt-1 text-sm text-muted-fg leading-relaxed">
                    {bot.key === "telegram"
                      ? "Заявка через бот за минуту, статус приходит автоматически."
                      : "Если используете Max — пишите здесь, тот же сервис."}
                  </div>
                  <div className="mt-6 inline-flex items-center gap-2 text-sm text-primary group-hover:gap-3 transition-all">
                    <MessageCircle className="h-4 w-4" />
                    Открыть чат
                  </div>
                </div>
              </a>
            </RevealItem>
          ))}

          {/* Телефон */}
          <RevealItem>
            <a
              href={`tel:${company.phoneTel}`}
              className="card-interactive p-6 h-full block group relative overflow-hidden"
            >
              <div className="relative">
                <div className="h-12 w-12 rounded-xl flex items-center justify-center border border-emerald-500/30 bg-emerald-500/15 text-emerald-400 mb-5">
                  <Phone className="h-5 w-5" />
                </div>
                <div className="text-lg font-semibold tracking-tight">Позвонить</div>
                <div className="mt-1 text-sm text-muted-fg leading-relaxed">
                  Если задача срочная или хочется голосом — звоните прямо сейчас.
                </div>
                <div className="mt-6 text-sm text-emerald-400 font-mono tabular-nums">
                  {company.phone}
                </div>
              </div>
            </a>
          </RevealItem>

          {/* Форма */}
          <RevealItem>
            <Link href="#request" className="card-interactive p-6 h-full block group relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-accent/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative">
                <div className="h-12 w-12 rounded-xl flex items-center justify-center border border-accent/30 bg-accent/15 text-accent mb-5">
                  <Send className="h-5 w-5" />
                </div>
                <div className="text-lg font-semibold tracking-tight">Форма на сайте</div>
                <div className="mt-1 text-sm text-muted-fg leading-relaxed">
                  Оставьте номер — перезвоним за 15 минут, без спама и обзвонов.
                </div>
                <div className="mt-6 inline-flex items-center gap-2 text-sm text-accent group-hover:gap-3 transition-all">
                  К форме <span aria-hidden>→</span>
                </div>
              </div>
            </Link>
          </RevealItem>
        </RevealStagger>

        <Reveal delay={0.1}>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="card p-4 flex items-start gap-3">
              <Clock className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <div className="text-sm">
                <div className="font-medium">Часы работы</div>
                <div className="text-muted-fg text-xs mt-0.5">Пн–Пт 9:00–20:00 · Сб 10:00–18:00</div>
              </div>
            </div>
            <div className="card p-4 flex items-start gap-3">
              <MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <div className="text-sm">
                <div className="font-medium">Сервис-центр</div>
                <div className="text-muted-fg text-xs mt-0.5">{company.address}</div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function TelegramIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
      <path d="M21.05 3.43 2.6 10.49c-1.26.48-1.25 1.18-.23 1.49l4.73 1.48 10.96-6.92c.52-.32.99-.15.6.2l-8.88 8.02-.34 5.07c.43 0 .62-.2.86-.43l2.07-2.01 4.3 3.18c.79.44 1.36.21 1.56-.73l2.82-13.31c.29-1.16-.43-1.68-1.2-1.13z" />
    </svg>
  );
}

function MaxIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
      <path d="M4 4h3l3 8 3-8h3l-1.5 14h-2L13 8l-3 8h-2l-3-8L4 18H2L4 4z" />
    </svg>
  );
}
