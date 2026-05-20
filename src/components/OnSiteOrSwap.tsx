import { Reveal, RevealStagger, RevealItem } from "./Reveal";
import { MapPin, Repeat, Wrench, Clock } from "lucide-react";

export function OnSiteOrSwap() {
  return (
    <section className="relative py-20 lg:py-28 border-y border-border overflow-hidden">
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-grid mask-fade-edges opacity-30" />
        <div className="absolute top-1/3 left-0 h-[420px] w-[420px] bg-primary/10 blur-[120px] rounded-full" />
      </div>

      <div className="container relative">
        <Reveal>
          <div className="chip mb-4"><span className="font-mono text-primary">Заправка</span> Как мы работаем</div>
          <h2 className="heading-display text-4xl md:text-5xl lg:text-6xl max-w-3xl">
            Заправим на месте<br />
            или <span className="text-gradient">подменим без ожидания</span>
          </h2>
          <p className="mt-6 text-muted-fg max-w-2xl leading-relaxed">
            У выездного сервиса есть честные ограничения, и мы их не скрываем. Поэтому даём клиенту выбор — что важнее: чтобы мастер сделал всё у вас, или чтобы офис как можно быстрее вернулся к печати.
          </p>
        </Reveal>

        <RevealStagger className="mt-12 grid gap-5 lg:grid-cols-2">
          <RevealItem>
            <div className="card p-7 lg:p-8 h-full relative overflow-hidden">
              <div className="absolute -top-px -left-px -right-px h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/15 border border-primary/30 text-primary flex items-center justify-center">
                  <MapPin className="h-5 w-5" />
                </div>
                <div className="font-mono text-xs text-muted-fg uppercase tracking-wider">Вариант A</div>
              </div>
              <h3 className="mt-5 text-2xl font-semibold tracking-tight">Заправка прямо у вас</h3>
              <p className="mt-3 text-sm text-muted-fg leading-relaxed">
                Мастер приезжает с тонером, инструментом и защитной плёнкой. Картридж разбирается на застеленной поверхности, ничего не рассыпается, в офисе остаётся всё как было.
              </p>
              <ul className="mt-5 space-y-2 text-sm">
                <Li>Используем тонер под конкретную модель картриджа</Li>
                <Li>Проверяем фотобарабан, лезвие, магнитный вал</Li>
                <Li>Контрольная печать на вашем принтере</Li>
                <Li>20–40 минут на месте, гарантия 30 дней</Li>
              </ul>
              <div className="mt-6 rounded-xl border border-border bg-bg/40 p-4 text-xs text-muted-fg leading-relaxed">
                <span className="text-fg font-medium">Честно:</span> полноценная глубокая чистка картриджа с разборкой узла и продувкой требует отдельного рабочего места и вытяжки. На выезде мы делаем аккуратную заправку — без имитации «полного цеха» у вас в офисе.
              </div>
            </div>
          </RevealItem>

          <RevealItem>
            <div className="card p-7 lg:p-8 h-full relative overflow-hidden">
              <div className="absolute -top-px -left-px -right-px h-px bg-gradient-to-r from-transparent via-accent/50 to-transparent" />
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-accent/15 border border-accent/30 text-accent flex items-center justify-center">
                  <Repeat className="h-5 w-5" />
                </div>
                <div className="font-mono text-xs text-muted-fg uppercase tracking-wider">Вариант B · быстрее</div>
              </div>
              <h3 className="mt-5 text-2xl font-semibold tracking-tight">Подмена на заранее заправленный</h3>
              <p className="mt-3 text-sm text-muted-fg leading-relaxed">
                Привозим уже заправленный и проверенный картридж той же модели. Ставим, забираем ваш пустой — и офис продолжает печатать через 5 минут. <span className="text-fg">По цене обычной заправки.</span>
              </p>
              <ul className="mt-5 space-y-2 text-sm">
                <Li>Не нужно ждать процесс заправки на месте</Li>
                <Li>Картридж уже прошёл чистку и тестовую печать в сервисе</Li>
                <Li>Ваш пустой едет к нам, восстанавливается, идёт в следующую подмену</Li>
                <Li>Особенно удобно для офисов, где простой печати тормозит работу</Li>
              </ul>
              <div className="mt-6 rounded-xl border border-border bg-bg/40 p-4 text-xs text-muted-fg leading-relaxed">
                <span className="text-fg font-medium">Когда выбирать:</span> если каждая минута без печати дороже, чем 30 минут визита мастера. Или если предыдущая заправка дала бледность/полосы — значит, картриджу нужна не просто заправка, а сервисная чистка.
              </div>
            </div>
          </RevealItem>
        </RevealStagger>

        <Reveal delay={0.1}>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat icon={Clock} title="Цель — быстрее вернуть печать" desc="Не просто «заправили картридж», а вернули офис к работе." />
            <Stat icon={Wrench} title="Подбор тонера" desc="Под конкретную модель — не универсальный «один на всех»." />
            <Stat icon={Repeat} title="Подменный фонд" desc="Держим популярные модели HP, Canon, Samsung в готовности." />
            <Stat icon={MapPin} title="Чистый выезд" desc="Защитная плёнка, пылесос, утилизация отходов." />
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Li({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5 items-start">
      <span className="mt-2 h-1 w-1 rounded-full bg-primary shrink-0" />
      <span className="text-fg/85 leading-relaxed">{children}</span>
    </li>
  );
}

function Stat({ icon: Icon, title, desc }: { icon: any; title: string; desc: string }) {
  return (
    <div className="card p-5">
      <Icon className="h-4 w-4 text-primary" />
      <div className="mt-3 text-sm font-medium">{title}</div>
      <div className="mt-1 text-xs text-muted-fg leading-relaxed">{desc}</div>
    </div>
  );
}
