import { Reveal } from "./Reveal";
import { Zap, ShieldCheck, FileText, Microscope, Wallet, Repeat } from "lucide-react";

const features = [
  {
    icon: Zap,
    title: "Выезд за час",
    desc: "По СПб в рабочие часы. Не «когда сможем», а с конкретным временем.",
  },
  {
    icon: Repeat,
    title: "Подменный картридж",
    desc: "Если ждать заправку некогда — привезём готовый, заберём пустой. По цене заправки.",
  },
  {
    icon: Microscope,
    title: "Тонер под модель",
    desc: "Подбираем тонер под конкретный картридж. Универсальный «один на всех» — не наш подход.",
  },
  {
    icon: Wallet,
    title: "Оплата после печати",
    desc: "Сначала ставим — тестируем — и только тогда расчёт. Не работает — не платите.",
  },
  {
    icon: ShieldCheck,
    title: "Гарантия 30 дней",
    desc: "Перестал печатать — приедем и переделаем без вопросов. Это работа, а не аттракцион.",
  },
  {
    icon: FileText,
    title: "Документы для юр.лиц",
    desc: "Договор, счёт, акт, УПД — оформляем при выезде или заранее.",
  },
];

export function WhyUs() {
  return (
    <section className="container py-20 lg:py-28">
      <Reveal>
        <div className="flex items-end justify-between gap-6 flex-wrap mb-12">
          <div>
            <div className="chip mb-4"><span className="font-mono text-primary">03</span> Почему мы</div>
            <h2 className="heading-display text-4xl md:text-5xl lg:text-6xl max-w-3xl">
              Не «лучшие на рынке».<br /><span className="text-gradient">Конкретно лучше</span> в нескольких вещах
            </h2>
          </div>
          <p className="text-muted-fg max-w-md leading-relaxed">
            Узкая специализация даёт глубину: мы каждый день разбираем те же модели картриджей, что и вчера. Не «и принтеры тоже умеем» — а только и именно принтеры.
          </p>
        </div>
      </Reveal>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {features.map((f, i) => (
          <Reveal key={f.title} delay={i * 0.05}>
            <div className="card p-6 h-full">
              <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-4">
                <f.icon className="h-4 w-4" />
              </div>
              <div className="font-semibold">{f.title}</div>
              <div className="mt-1.5 text-sm text-muted-fg leading-relaxed">{f.desc}</div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
