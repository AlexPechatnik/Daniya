import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Reveal, RevealStagger, RevealItem } from "@/components/Reveal";
import { ParallaxBg } from "@/components/ParallaxBg";
import { CounterNumber } from "@/components/CounterNumber";
import { company, team, companyStats } from "@/lib/company";
import {
  MapPin, Phone, Mail, Clock, ArrowRight, Quote, MessageCircle,
  ShieldCheck, Wrench, Microscope, Wallet, Building2, CheckCircle2,
} from "lucide-react";
import { publicBotLinks } from "@/lib/publicBotLinks";

export const metadata: Metadata = {
  title: "Познакомимся — PrintCare СПб",
  description:
    "Заправка картриджей и обслуживание принтеров в Санкт-Петербурге с 2007 года. Работаем сами, без посредников. От 2 принтеров в офисе до большого парка техники.",
};

const principles = [
  {
    icon: Wrench,
    title: "Делаем сами, без посредников",
    text: "Никакой передачи на сторону. От первого звонка до контрольной печати — всё руками наших мастеров.",
  },
  {
    icon: Microscope,
    title: "Тонер под конкретную модель",
    text: "Не «универсальный для всех HP». Под каждый ходовой картридж — свой состав и проверенный поставщик.",
  },
  {
    icon: ShieldCheck,
    title: "Не возьмёмся, если бесполезно",
    text: "Если картриджу пора на пенсию — скажем прямо. Не будем тянуть деньги на бесконечные перезаправки.",
  },
  {
    icon: Wallet,
    title: "Оплата после результата",
    text: "Сначала проверяем печать, потом расчёт. Не получилось — заплатите только за выезд.",
  },
];

const workshopFeatures = [
  "Вытяжка для безопасной разборки картриджей",
  "Ультразвуковая ванна для прочистки сопел струйных принтеров",
  "Диагностические стенды для лазерной техники",
  "Подменный фонд — 30+ ходовых моделей картриджей всегда в наличии",
  "Чистый цех — никакой пыли тонера на ваших офисных принтерах",
];

export default function Page() {
  const bots = publicBotLinks();

  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden border-b border-border">
        <ParallaxBg />
        <div className="container relative py-16 lg:py-24">
          <Reveal>
            <div className="chip mb-6"><span className="font-mono text-primary">07</span> Познакомимся</div>
            <h1 className="heading-display text-4xl md:text-6xl lg:text-7xl max-w-4xl">
              Заправляем картриджи<br />
              и чиним принтеры в&nbsp;СПб<br />
              <span className="text-gradient">с 2007 года</span>
            </h1>
            <p className="mt-8 max-w-2xl text-lg text-muted-fg leading-relaxed">
              Помогаем компаниям держать печатную технику в&nbsp;рабочем состоянии:
              заправляем картриджи, ремонтируем и&nbsp;обслуживаем принтеры.
              Работаем с&nbsp;организациями любого масштаба — от&nbsp;офисов
              с&nbsp;2–3 принтерами до&nbsp;парков из&nbsp;сотен устройств.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/#request" className="btn-primary btn-glow px-6 py-3.5">
                Оставить заявку <ArrowRight className="h-4 w-4" />
              </Link>
              {bots[0] && (
                <a href={bots[0].href} target="_blank" rel="noreferrer" className="btn-outline px-6 py-3.5">
                  <MessageCircle className="h-4 w-4" /> Написать в {bots[0].label}
                </a>
              )}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ЦИФРЫ */}
      <section className="container py-14 lg:py-20">
        <RevealStagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Лет на рынке" value={companyStats.yearsOnMarket} suffix="+" />
          <StatCard label="Заправлено картриджей" value={companyStats.cartridgesRefilled} />
          <StatCard label="Отремонтировано принтеров" value={companyStats.printersRepaired} />
          <StatCard label="Постоянных клиентов" value={companyStats.loyalClients} />
        </RevealStagger>
      </section>

      {/* КОМАНДА — фото + цитата */}
      <section className="container py-16 lg:py-24">
        <Reveal>
          <div className="chip mb-4"><span className="font-mono text-primary">02</span> Команда</div>
          <h2 className="heading-display text-3xl md:text-4xl lg:text-5xl max-w-2xl">
            Мы сами выполняем все работы.<br />
            <span className="text-gradient">Без посредников и&nbsp;раздутого штата</span>
          </h2>
        </Reveal>

        <div className="mt-12 grid gap-8 lg:grid-cols-2 items-center">
          {team.map((m, i) => (
            <Reveal key={m.name} delay={i * 0.05}>
              <div className="grid gap-6 sm:grid-cols-[260px,1fr] items-start">
                <MasterPhoto src={m.photo} name={m.name} />
                <div>
                  <div className="font-mono text-xs uppercase tracking-wider text-primary">
                    {m.role} · {m.years} лет в профессии
                  </div>
                  <div className="mt-2 text-2xl font-semibold tracking-tight">{m.name}</div>
                  <div className="mt-1 text-sm text-muted-fg">{m.speciality}</div>
                  {m.quote && (
                    <div className="mt-5 relative rounded-2xl border border-border bg-card/40 p-5 lg:p-6">
                      <Quote className="absolute -top-3 left-5 h-5 w-5 text-primary bg-bg rounded-full p-0.5" />
                      <p className="text-sm leading-relaxed text-fg/85 italic">
                        «{m.quote}»
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </Reveal>
          ))}

          <Reveal delay={0.1}>
            <div className="card p-6 lg:p-8 h-full">
              <div className="text-xs uppercase tracking-wider text-muted-fg">Кто мы и&nbsp;для&nbsp;кого</div>
              <div className="mt-3 space-y-4 text-fg/85 leading-relaxed">
                <p>
                  Работаем с&nbsp;2007 года. За&nbsp;это время через нас прошли тысячи картриджей,
                  сотни моделей принтеров — от&nbsp;старых рабочих лошадок HP LaserJet 1010
                  до&nbsp;современных МФУ Kyocera.
                </p>
                <p>
                  Помогаем небольшим офисам, где принтер один, но&nbsp;он критичный.
                  Сопровождаем компании с&nbsp;большим парком — договор, выезды
                  по&nbsp;запросу, закрывающие документы, единая точка ответственности.
                </p>
                <p>
                  Не&nbsp;распыляемся на&nbsp;«заодно и&nbsp;пылесос починим» — только
                  печатная техника. Узкая специализация даёт глубину: мы каждый день
                  разбираем те&nbsp;же узлы, что и&nbsp;вчера.
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* МАСТЕРСКАЯ */}
      <section className="relative py-16 lg:py-24 border-y border-border overflow-hidden">
        <div aria-hidden className="absolute inset-0 bg-grid mask-fade-edges opacity-30" />
        <div className="container relative grid gap-12 lg:grid-cols-2 items-center">
          <Reveal>
            <div className="chip mb-4"><span className="font-mono text-primary">03</span> Мастерская</div>
            <h2 className="heading-display text-3xl md:text-4xl lg:text-5xl">
              Сервис-центр<br /><span className="text-gradient">в&nbsp;Мурино</span>
            </h2>
            <p className="mt-5 text-muted-fg leading-relaxed max-w-md">
              Полноценная сервисная мастерская со&nbsp;всем оборудованием для аккуратной
              разборки и&nbsp;диагностики. Сюда едут картриджи и&nbsp;принтеры,
              которым нужна более серьёзная работа, чем можно сделать на&nbsp;выезде.
            </p>
            <ul className="mt-6 space-y-2.5 text-sm">
              {workshopFeatures.map((f) => (
                <li key={f} className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span className="text-fg/85">{f}</span>
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="card p-6 lg:p-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-xl bg-primary/15 border border-primary/30 text-primary flex items-center justify-center">
                  <MapPin className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-fg">Адрес сервис-центра</div>
                  <div className="font-semibold">{company.address}</div>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3 mt-6">
                <ContactRow icon={Phone} label="Телефон" value={company.phone} href={`tel:${company.phoneTel}`} />
                <ContactRow icon={Mail} label="Email" value={company.email} href={`mailto:${company.email}`} />
                <ContactRow icon={Clock} label="Будни" value={company.workingHours.weekday} />
                <ContactRow icon={Clock} label="Суббота" value={company.workingHours.saturday} />
              </div>

              <a
                href={company.yandexMapsUrl}
                target="_blank"
                rel="noreferrer"
                className="btn-outline w-full mt-6 justify-center"
              >
                <MapPin className="h-4 w-4" /> Построить маршрут
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ПРИНЦИПЫ */}
      <section className="container py-16 lg:py-24">
        <Reveal>
          <div className="chip mb-4"><span className="font-mono text-primary">04</span> Принципы</div>
          <h2 className="heading-display text-3xl md:text-4xl lg:text-5xl max-w-3xl">
            Без посредников.<br />
            <span className="text-gradient">Поэтому быстро и&nbsp;честно</span>
          </h2>
        </Reveal>
        <RevealStagger className="mt-12 grid gap-4 md:grid-cols-2">
          {principles.map((p) => (
            <RevealItem key={p.title}>
              <div className="card p-6 h-full">
                <div className="h-11 w-11 rounded-xl bg-primary/15 border border-primary/30 text-primary flex items-center justify-center">
                  <p.icon className="h-5 w-5" />
                </div>
                <div className="mt-4 font-semibold tracking-tight">{p.title}</div>
                <div className="mt-2 text-sm text-muted-fg leading-relaxed">{p.text}</div>
              </div>
            </RevealItem>
          ))}
        </RevealStagger>
      </section>

      {/* ДЛЯ ЮР.ЛИЦ */}
      <section className="container py-16 lg:py-20">
        <Reveal>
          <div className="card glass p-8 lg:p-12 relative overflow-hidden">
            <div aria-hidden className="absolute -top-32 right-1/4 h-[420px] w-[420px] bg-primary/15 blur-[120px] rounded-full pointer-events-none" />
            <div className="relative grid gap-8 lg:grid-cols-[1fr,auto] items-center">
              <div>
                <div className="chip mb-4"><Building2 className="h-3.5 w-3.5 text-primary" /> Для организаций</div>
                <h3 className="heading-display text-2xl md:text-3xl lg:text-4xl">
                  Договор, документы, один менеджер<br />
                  <span className="text-gradient">на&nbsp;весь ваш парк</span>
                </h3>
                <p className="mt-4 text-muted-fg max-w-xl leading-relaxed">
                  Подписываем договор, выставляем счета, привозим закрывающие документы.
                  Один человек отвечает за&nbsp;всё, никаких «мы&nbsp;вам перезвоним».
                  Безналичный расчёт, отсрочка, при необходимости — НДС.
                </p>
              </div>
              <div className="flex flex-col gap-3">
                <Link href="/corporate" className="btn-primary btn-glow px-5 py-3 whitespace-nowrap">
                  Узнать подробнее <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/#request" className="btn-outline px-5 py-3 whitespace-nowrap text-center">
                  Запросить расчёт
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}

// ────────────────────────────────────────────────────────────────────────────

function StatCard({ label, value, suffix }: { label: string; value: string | number; suffix?: string }) {
  return (
    <RevealItem>
      <div className="card p-6">
        <div className="text-xs uppercase tracking-wider text-muted-fg">{label}</div>
        <div className="mt-3 text-4xl lg:text-5xl font-semibold tracking-tightest tabular-nums text-gradient">
          {typeof value === "number" ? <CounterNumber value={value} /> : value}
          {suffix}
        </div>
      </div>
    </RevealItem>
  );
}

function MasterPhoto({ src, name }: { src: string | null; name: string }) {
  if (!src) {
    return (
      <div className="aspect-[3/4] rounded-2xl border border-border bg-gradient-to-br from-primary/20 to-accent/10 flex items-center justify-center">
        <div className="text-6xl font-semibold tracking-tight text-fg/40">{name[0]}</div>
      </div>
    );
  }
  return (
    <div className="aspect-[3/4] rounded-2xl border border-border overflow-hidden bg-bg-2 relative">
      <Image
        src={src}
        alt={`Мастер ${name}`}
        fill
        sizes="(max-width: 640px) 100vw, 260px"
        className="object-cover"
        priority={false}
      />
    </div>
  );
}

function ContactRow({ icon: Icon, label, value, href }: { icon: any; label: string; value: string; href?: string }) {
  const inner = (
    <div className="flex items-start gap-3">
      <Icon className="h-4 w-4 text-primary shrink-0 mt-0.5" />
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-muted-fg">{label}</div>
        <div className="text-sm font-medium truncate">{value}</div>
      </div>
    </div>
  );
  if (href) return <a href={href} className="hover:text-primary transition">{inner}</a>;
  return inner;
}
