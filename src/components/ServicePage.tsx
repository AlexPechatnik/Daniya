import Link from "next/link";
import { Reveal } from "./Reveal";
import { CheckCircle2, ArrowRight, ArrowUpRight } from "lucide-react";

export interface ServicePageProps {
  title: string;
  subtitle: string;
  bullets: string[];
  priceFrom?: string;
  faq?: { q: string; a: string }[];
  related?: { href: string; label: string }[];
}

export function ServicePage({ title, subtitle, bullets, priceFrom, faq, related }: ServicePageProps) {
  return (
    <>
      <section className="relative overflow-hidden border-b border-border">
        <div aria-hidden className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-grid mask-fade-edges opacity-50" />
          <div className="absolute -top-32 left-1/3 h-[420px] w-[420px] bg-primary/20 blur-[120px] rounded-full animate-float-slow" />
        </div>
        <div className="container relative py-16 lg:py-24">
          <Reveal>
            <Link href="/" className="chip mb-6 hover:text-fg transition">← На главную</Link>
            <h1 className="heading-display text-4xl md:text-6xl lg:text-7xl max-w-4xl">{title}</h1>
            <p className="mt-6 max-w-2xl text-lg text-muted-fg leading-relaxed">{subtitle}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/#request" className="btn-primary btn-glow px-6 py-3.5">Оставить заявку <ArrowRight className="h-4 w-4" /></Link>
              <Link href="/#calculator" className="btn-outline px-6 py-3.5">Рассчитать стоимость</Link>
            </div>
            {priceFrom && (
              <div className="mt-6 chip">Стоимость <span className="text-fg font-medium ml-1.5">{priceFrom}</span></div>
            )}
          </Reveal>
        </div>
      </section>

      <section className="container py-16 lg:py-24">
        <Reveal><h2 className="heading-display text-3xl md:text-4xl">Что входит</h2></Reveal>
        <ul className="mt-10 grid gap-3 md:grid-cols-2">
          {bullets.map((b, i) => (
            <Reveal key={b} delay={i * 0.04}>
              <li className="flex items-start gap-3 card p-5">
                <CheckCircle2 className="h-5 w-5 text-success shrink-0 mt-0.5" />
                <span className="text-sm">{b}</span>
              </li>
            </Reveal>
          ))}
        </ul>
      </section>

      {faq && faq.length > 0 && (
        <section className="container py-16 lg:py-24">
          <Reveal><h2 className="heading-display text-3xl md:text-4xl">Частые вопросы</h2></Reveal>
          <div className="mt-10 grid gap-3 max-w-3xl">
            {faq.map((f, i) => (
              <Reveal key={f.q} delay={i * 0.04}>
                <details className="card p-5 group">
                  <summary className="cursor-pointer font-medium flex items-center justify-between gap-4 list-none">
                    {f.q}
                    <span className="text-primary group-open:rotate-45 transition text-lg leading-none">+</span>
                  </summary>
                  <p className="mt-3 text-sm text-muted-fg leading-relaxed">{f.a}</p>
                </details>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {related && related.length > 0 && (
        <section className="container py-16">
          <h2 className="heading-display text-3xl md:text-4xl">Смежные услуги</h2>
          <div className="mt-8 flex flex-wrap gap-2">
            {related.map((r) => (
              <Link key={r.href} href={r.href} className="btn-outline">
                {r.label} <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
