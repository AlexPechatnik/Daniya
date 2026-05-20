import { Reveal } from "@/components/Reveal";
import { CheckCircle2, ArrowRight } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Обслуживание оргтехники для бизнеса в СПб",
  description: "Договор на абонентское обслуживание принтеров и МФУ. Скидки от объёма, выезды, закрывающие документы.",
};

const benefits = [
  "Договор и закрывающие документы — счёт, акт, УПД",
  "Скидки от объёма парка техники",
  "Приоритетный выезд для клиентов на абонентке",
  "Учёт расходников и истории по каждому принтеру",
  "Безналичный расчёт, отсрочка платежа",
  "Один менеджер по всему вашему парку",
];

export default function Page() {
  return (
    <>
      <section className="relative overflow-hidden border-b border-border">
        <div aria-hidden className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-grid mask-fade-edges opacity-40" />
          <div className="absolute -top-32 right-1/4 h-[420px] w-[420px] bg-primary/15 blur-[120px] rounded-full" />
        </div>
        <div className="container relative py-16 lg:py-24">
          <Reveal>
            <div className="chip mb-6">Для организаций</div>
            <h1 className="heading-display max-w-3xl text-4xl md:text-6xl lg:text-7xl">
              Обслуживание<br /><span className="text-gradient">всего парка техники</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-muted-fg leading-relaxed">
              Берём на сопровождение принтеры и МФУ компании: заправки, замены, ремонт, расходники. Один договор, один счёт, один ответственный.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/#request" className="btn-primary btn-glow px-6 py-3.5">Запросить расчёт <ArrowRight className="h-4 w-4" /></Link>
              <Link href="/price" className="btn-outline px-6 py-3.5">Прайс</Link>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="container py-16 lg:py-24">
        <Reveal><h2 className="heading-display text-3xl md:text-4xl">Что получаете</h2></Reveal>
        <ul className="mt-10 grid gap-3 md:grid-cols-2">
          {benefits.map((b, i) => (
            <Reveal key={b} delay={i * 0.04}>
              <li className="flex items-start gap-3 card p-5">
                <CheckCircle2 className="h-5 w-5 text-success shrink-0 mt-0.5" />
                <span className="text-sm">{b}</span>
              </li>
            </Reveal>
          ))}
        </ul>
      </section>
    </>
  );
}
