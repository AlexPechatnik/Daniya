"use client";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { PhoneCall, CalendarCheck, Truck, ShieldCheck } from "lucide-react";

const steps = [
  { icon: PhoneCall, title: "Заявка", desc: "Оставьте номер на сайте, в мессенджере или позвоните." },
  { icon: CalendarCheck, title: "Подтверждение", desc: "Перезвоним за 15 минут и согласуем время выезда." },
  { icon: Truck, title: "Выезд мастера", desc: "Приедем со всем инструментом и расходниками." },
  { icon: ShieldCheck, title: "Печать и оплата", desc: "Оплата после проверки печати. 30 дней гарантии." },
];

export function HowItWorks() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 70%", "end 30%"] });
  const fill = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);

  return (
    <section ref={ref} className="container py-20 lg:py-28">
      <div className="flex items-end justify-between gap-6 flex-wrap mb-12">
        <div>
          <div className="chip mb-4"><span className="font-mono text-primary">02</span> Как это работает</div>
          <h2 className="heading-display text-4xl md:text-5xl lg:text-6xl">Четыре шага<br /><span className="text-gradient">без сюрпризов</span></h2>
        </div>
      </div>

      <div className="relative grid lg:grid-cols-4 gap-6">
        {/* Прогресс-линия: вертикальная на мобиле, горизонтальная на ≥lg */}
        <div aria-hidden className="absolute top-7 left-7 bottom-7 w-px bg-border lg:hidden">
          <motion.div className="w-full bg-gradient-to-b from-primary to-accent origin-top" style={{ height: fill }} />
        </div>
        <div aria-hidden className="absolute hidden lg:block lg:top-7 lg:left-0 lg:right-0 lg:h-px bg-border">
          <motion.div className="h-full bg-gradient-to-r from-primary to-accent origin-left" style={{ width: fill }} />
        </div>

        {steps.map((s, i) => (
          <motion.div
            key={s.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ delay: i * 0.1, duration: 0.6 }}
            className="relative pl-20 lg:pl-0"
          >
            <div className="absolute left-0 top-0 lg:relative lg:left-auto lg:top-auto h-14 w-14 rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/20 to-card flex items-center justify-center text-primary mb-0 lg:mb-6">
              <s.icon className="h-5 w-5" />
              <div className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-bg border border-border text-[10px] font-mono flex items-center justify-center text-muted-fg">
                0{i + 1}
              </div>
            </div>
            <div className="text-lg font-semibold tracking-tight">{s.title}</div>
            <div className="mt-1.5 text-sm text-muted-fg max-w-xs">{s.desc}</div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
