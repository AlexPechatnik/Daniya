import Link from "next/link";
import { Droplet, Replace, Stethoscope, Wrench, ArrowUpRight } from "lucide-react";
import { Reveal, RevealStagger, RevealItem } from "./Reveal";
import { ServiceGraphicRefill, ServiceGraphicRepair } from "./ServiceGraphics";

const items = [
  {
    href: "/services/zapravka", icon: Droplet, title: "Заправка картриджей",
    desc: "Качественный тонер, проверка печати, чистка узлов.", price: "от 400 ₽",
    size: "lg" as const, accent: "from-primary/20 to-transparent",
    graphic: "refill" as const,
  },
  {
    href: "/services/zamena", icon: Replace, title: "Замена картриджей",
    desc: "Оригинал или совместимый.", price: "от 900 ₽", size: "sm" as const,
  },
  {
    href: "/services/diagnostika", icon: Stethoscope, title: "Диагностика",
    desc: "Точная причина до начала ремонта.", price: "от 500 ₽", size: "sm" as const,
  },
  {
    href: "/services/remont", icon: Wrench, title: "Ремонт принтеров",
    desc: "Термоузел, ролик, плата, механика.", price: "от 1 200 ₽",
    size: "lg" as const, accent: "from-accent/15 to-transparent",
    graphic: "repair" as const,
  },
];

export function Services() {
  return (
    <section className="container py-20 lg:py-28">
      <Reveal>
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div>
            <div className="chip mb-4"><span className="font-mono text-primary">01</span> Услуги</div>
            <h2 className="heading-display text-4xl md:text-5xl lg:text-6xl max-w-2xl">
              Только принтеры.<br /><span className="text-gradient">Никакого «всё подряд»</span>
            </h2>
          </div>
          <p className="text-muted-fg max-w-md">Узкая специализация — выше качество и быстрее выезд. Не чиним пылесосы и чайники, спасаем только печать.</p>
        </div>
      </Reveal>

      <RevealStagger className="mt-12 grid gap-4 md:grid-cols-3 auto-rows-[200px] md:auto-rows-[260px]">
        {items.map((it, i) => (
          <RevealItem key={it.href} className={it.size === "lg" ? "md:row-span-2 md:col-span-1" : ""}>
            <Link href={it.href} className="group relative block h-full card-interactive p-6 overflow-hidden">
              {it.accent && <div className={`absolute inset-0 bg-gradient-to-br ${it.accent} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />}
              <div className="relative h-full flex flex-col">
                <div className="flex items-start justify-between">
                  <div className="h-11 w-11 rounded-xl bg-primary/15 text-primary flex items-center justify-center border border-primary/20">
                    <it.icon className="h-5 w-5" />
                  </div>
                  <ArrowUpRight className="h-5 w-5 text-muted-fg group-hover:text-primary group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition" />
                </div>

                {/* Infographic для крупных карточек */}
                {it.size === "lg" && (
                  <div className="mt-5 mb-4 flex-1 flex items-center justify-center">
                    {it.graphic === "refill" && <ServiceGraphicRefill />}
                    {it.graphic === "repair" && <ServiceGraphicRepair />}
                  </div>
                )}

                <div className={it.size === "lg" ? "" : "mt-auto"}>
                  <div className="text-lg font-semibold tracking-tight">{it.title}</div>
                  <div className="mt-1.5 text-sm text-muted-fg">{it.desc}</div>
                  <div className="mt-4 inline-flex items-center gap-2 text-xs">
                    <span className="font-mono text-primary">{it.price}</span>
                  </div>
                </div>
              </div>
            </Link>
          </RevealItem>
        ))}
      </RevealStagger>
    </section>
  );
}
