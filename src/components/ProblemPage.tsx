import Link from "next/link";
import { Reveal } from "./Reveal";
import { AlertCircle, Wrench, Phone, ArrowRight, AlertTriangle, Hammer, BookOpen } from "lucide-react";

export interface ProblemDeepDive {
  title: string;
  intro?: string;
  items?: string[];
  warn?: string;
}

export interface ProblemPageProps {
  title: string;
  intro: string;
  causes: string[];
  selfCheck: string[];
  callMaster: string[];
  estimatedCost: string;
  tools?: string[];           // что нужно для самостоятельной попытки
  donts?: string[];           // чего нельзя делать
  deepDive?: ProblemDeepDive[]; // подробные разделы
  related?: { href: string; label: string }[];
  faq?: { q: string; a: string }[];
}

export function ProblemPage(p: ProblemPageProps) {
  return (
    <>
      <section className="relative overflow-hidden border-b border-border">
        <div aria-hidden className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-grid mask-fade-edges opacity-40" />
          <div className="absolute -top-32 right-1/4 h-[400px] w-[400px] bg-warning/15 blur-[120px] rounded-full" />
        </div>
        <div className="container relative py-14 lg:py-20">
          <Reveal>
            <Link href="/problems" className="chip mb-6 hover:text-fg transition">
              <AlertCircle className="h-3.5 w-3.5 text-warning" /> ← Все проблемы
            </Link>
            <h1 className="heading-display max-w-3xl text-4xl md:text-5xl lg:text-6xl">{p.title}</h1>
            <p className="mt-6 max-w-2xl text-lg text-muted-fg leading-relaxed">{p.intro}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/#request" className="btn-primary btn-glow px-6 py-3.5"><Phone className="h-4 w-4" /> Вызвать мастера</Link>
              <Link href="/#calculator" className="btn-outline px-6 py-3.5"><Wrench className="h-4 w-4" /> Узнать цену</Link>
            </div>
            <div className="mt-6 chip">Стоимость работ <span className="text-fg font-medium ml-1.5">{p.estimatedCost}</span></div>
          </Reveal>
        </div>
      </section>

      <section className="container py-14 grid gap-5 lg:grid-cols-3">
        <Block title="Возможные причины" items={p.causes} tone="warning" />
        <Block title="Что проверить самому" items={p.selfCheck} tone="primary" />
        <Block title="Когда звать мастера" items={p.callMaster} tone="accent" />
      </section>

      {(p.tools || p.donts) && (
        <section className="container pb-4 grid gap-5 md:grid-cols-2">
          {p.tools && (
            <div className="card p-6">
              <div className="flex items-center gap-2 mb-4">
                <Hammer className="h-4 w-4 text-primary" />
                <div className="font-semibold">Что нужно, если делаете сами</div>
              </div>
              <ul className="space-y-2 text-sm text-muted-fg">
                {p.tools.map((t) => (
                  <li key={t} className="flex gap-2 leading-relaxed">
                    <span className="mt-2 h-1 w-1 rounded-full bg-primary/60 shrink-0" /> <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {p.donts && (
            <div className="card p-6 border-danger/30 bg-danger/[0.03]">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="h-4 w-4 text-danger" />
                <div className="font-semibold">Чего делать нельзя</div>
              </div>
              <ul className="space-y-2 text-sm text-muted-fg">
                {p.donts.map((t) => (
                  <li key={t} className="flex gap-2 leading-relaxed">
                    <span className="mt-2 h-1 w-1 rounded-full bg-danger/60 shrink-0" /> <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {p.deepDive && p.deepDive.length > 0 && (
        <section className="container py-10">
          <div className="flex items-center gap-2 mb-8">
            <BookOpen className="h-4 w-4 text-primary" />
            <h2 className="heading-display text-2xl md:text-3xl">Подробнее</h2>
          </div>
          <div className="space-y-5">
            {p.deepDive.map((d) => (
              <Reveal key={d.title}>
                <div className="card p-6 lg:p-7">
                  <div className="font-semibold tracking-tight text-lg">{d.title}</div>
                  {d.intro && <p className="mt-3 text-sm text-fg/85 leading-relaxed">{d.intro}</p>}
                  {d.items && (
                    <ul className="mt-4 space-y-2.5 text-sm text-fg/80">
                      {d.items.map((i, idx) => (
                        <li key={idx} className="flex gap-3 leading-relaxed">
                          <span className="font-mono text-xs text-muted-fg shrink-0 mt-0.5 w-6">{String(idx + 1).padStart(2, "0")}</span>
                          <span>{i}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {d.warn && (
                    <div className="mt-4 rounded-lg border border-warning/30 bg-warning/[0.06] p-3 text-xs text-warning leading-relaxed flex gap-2">
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>{d.warn}</span>
                    </div>
                  )}
                </div>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {p.faq && (
        <section className="container py-14">
          <h2 className="heading-display text-3xl md:text-4xl">Частые вопросы</h2>
          <div className="mt-8 grid gap-3 max-w-3xl">
            {p.faq.map((f) => (
              <details key={f.q} className="card p-5 group">
                <summary className="cursor-pointer font-medium flex items-center justify-between gap-4 list-none">
                  {f.q}
                  <span className="text-primary group-open:rotate-45 transition text-lg leading-none">+</span>
                </summary>
                <p className="mt-3 text-sm text-muted-fg leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      )}

      {p.related && (
        <section className="container py-14">
          <h2 className="heading-display text-3xl md:text-4xl">Смежные услуги и проблемы</h2>
          <div className="mt-8 flex flex-wrap gap-2">
            {p.related.map((r) => (
              <Link key={r.href} href={r.href} className="btn-outline">{r.label} <ArrowRight className="h-3.5 w-3.5" /></Link>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function Block({ title, items, tone }: { title: string; items: string[]; tone: "warning" | "primary" | "accent" }) {
  const dot = { warning: "bg-warning", primary: "bg-primary", accent: "bg-accent" }[tone];
  return (
    <div className="card p-6">
      <div className="flex items-center gap-2 mb-4">
        <span className={`h-2 w-2 rounded-full ${dot}`} />
        <div className="font-semibold">{title}</div>
      </div>
      <ul className="space-y-3 text-sm text-muted-fg">
        {items.map((i) => (
          <li key={i} className="flex gap-3 leading-relaxed">
            <span className={`mt-2 h-1 w-1 rounded-full shrink-0 ${dot} opacity-60`} />
            <span>{i}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
