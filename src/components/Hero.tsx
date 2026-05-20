"use client";
import Link from "next/link";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { Calculator, ArrowRight, MessageCircle, Sparkles } from "lucide-react";
import { useEffect, useRef } from "react";
import { primaryBotLink } from "@/lib/publicBotLinks";

export function Hero() {
  const bot = primaryBotLink();
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const smX = useSpring(mx, { stiffness: 80, damping: 20 });
  const smY = useSpring(my, { stiffness: 80, damping: 20 });
  const rotX = useTransform(smY, [-1, 1], [6, -6]);
  const rotY = useTransform(smX, [-1, 1], [-6, 6]);
  const tx = useTransform(smX, [-1, 1], [-15, 15]);
  const ty = useTransform(smY, [-1, 1], [-15, 15]);

  useEffect(() => {
    function onMove(e: MouseEvent) {
      const r = ref.current?.getBoundingClientRect();
      if (!r) return;
      mx.set(((e.clientX - r.left) / r.width - 0.5) * 2);
      my.set(((e.clientY - r.top) / r.height - 0.5) * 2);
    }
    function onLeave() { mx.set(0); my.set(0); }
    const el = ref.current;
    el?.addEventListener("mousemove", onMove);
    el?.addEventListener("mouseleave", onLeave);
    return () => {
      el?.removeEventListener("mousemove", onMove);
      el?.removeEventListener("mouseleave", onLeave);
    };
  }, [mx, my]);

  return (
    <section ref={ref} className="relative overflow-hidden border-b border-border">
      {/* Layered background */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-grid mask-fade-edges opacity-60" />
        <motion.div style={{ x: useTransform(smX, [-1, 1], [-30, 30]), y: useTransform(smY, [-1, 1], [-20, 20]) }}
          className="absolute -top-40 left-1/4 h-[500px] w-[500px] rounded-full bg-primary/25 blur-[120px] animate-float-slow" />
        <motion.div style={{ x: useTransform(smX, [-1, 1], [20, -20]), y: useTransform(smY, [-1, 1], [15, -15]) }}
          className="absolute top-40 right-0 h-[400px] w-[400px] rounded-full bg-accent/20 blur-[120px] animate-float-slow [animation-delay:-7s]" />
      </div>

      <div className="container relative pt-14 pb-20 lg:pt-24 lg:pb-32">
        <div className="grid lg:grid-cols-[1.15fr,1fr] gap-10 lg:gap-16 items-center">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}>
            <div className="chip">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-success/70 opacity-75 animate-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
              </span>
              Работаем сегодня · Санкт-Петербург
            </div>

            <h1 className="heading-display mt-6 text-[44px] sm:text-6xl lg:text-7xl xl:text-[88px]">
              Печать,<br />
              которая <span className="text-gradient">всегда работает</span>
            </h1>

            <p className="mt-6 max-w-xl text-lg text-muted-fg leading-relaxed">
              Заправим картридж прямо у вас — аккуратно, без грязи и пыли. А если время важнее, привезём <span className="text-fg">уже заправленный и проверенный</span> и заберём пустой. По цене обычной заправки.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="#request" className="btn-primary btn-glow text-base px-6 py-3.5">
                Вызвать мастера
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="#calculator" className="btn-outline text-base px-6 py-3.5">
                <Calculator className="h-4 w-4" />
                Рассчитать
              </Link>
              {bot && (
                <a href={bot.href} target="_blank" rel="noreferrer" className="btn-outline text-base px-6 py-3.5">
                  <MessageCircle className="h-4 w-4" />
                  Написать в бот
                </a>
              )}
            </div>

            <Stats />
          </motion.div>

          {/* Right: 3D printer card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, delay: 0.15 }}
            style={{ rotateX: rotX, rotateY: rotY, transformPerspective: 1000 }}
            className="relative hidden md:block"
          >
            <motion.div style={{ x: tx, y: ty }} className="relative">
              <PrinterCard />
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function Stats() {
  const items = [
    { v: "30 мин", k: "до приезда" },
    { v: "30 дн.", k: "гарантия" },
    { v: "5 000+", k: "заявок в год" },
    { v: "4.9★", k: "рейтинг" },
  ];
  return (
    <dl className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-px overflow-hidden rounded-2xl border border-border bg-border max-w-2xl">
      {items.map((it) => (
        <div key={it.k} className="bg-card/60 backdrop-blur px-4 py-4">
          <dt className="text-xs uppercase tracking-wider text-muted-fg">{it.k}</dt>
          <dd className="mt-1 text-xl font-semibold tracking-tight tabular-nums">{it.v}</dd>
        </div>
      ))}
    </dl>
  );
}

function PrinterCard() {
  return (
    <div className="glass rounded-3xl border border-border p-6 shadow-2xl shadow-primary/10">
      <div className="flex items-center justify-between text-xs text-muted-fg">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-success" />
          <span className="font-mono">printer.online</span>
        </div>
        <span className="font-mono">queue: 0</span>
      </div>

      <div className="mt-5 relative h-64 rounded-2xl bg-gradient-to-br from-bg-2 to-bg border border-border overflow-hidden">
        <svg viewBox="0 0 320 240" className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid meet">
          <defs>
            <linearGradient id="body-g" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="hsl(222 24% 24%)" />
              <stop offset="1" stopColor="hsl(222 24% 13%)" />
            </linearGradient>
            <linearGradient id="paper-g" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#f8fafc" />
              <stop offset="1" stopColor="#cbd5e1" />
            </linearGradient>
            {/* Маска, повторяющая текущую высоту листа. К ней крепятся и сам лист, и строки текста, — поэтому текст не появляется раньше, чем бумага доезжает до него. */}
            <clipPath id="paper-area">
              <rect x="100" y="144" width="120" height="0">
                <animate attributeName="height" values="0;60;60;0" keyTimes="0;0.55;0.92;1" dur="4s" repeatCount="indefinite" />
              </rect>
            </clipPath>
          </defs>

          {/* Стопка во входном лотке сверху */}
          <rect x="110" y="34" width="100" height="6" rx="1" fill="hsl(222 24% 30%)" />
          <rect x="108" y="40" width="104" height="4" rx="1" fill="hsl(222 24% 26%)" />
          <rect x="106" y="44" width="108" height="4" rx="1" fill="hsl(222 24% 22%)" />

          {/* Корпус принтера */}
          <rect x="60" y="50" width="200" height="100" rx="10" fill="url(#body-g)" stroke="hsl(var(--border))" />

          {/* Передняя панель */}
          <rect x="72" y="62" width="176" height="58" rx="6" fill="hsl(222 28% 11%)" stroke="hsl(var(--border))" />

          {/* Полоска "дисплея" */}
          <rect x="84" y="74" width="80" height="3" rx="1.5" fill="hsl(199 80% 50% / 0.5)" />
          <rect x="84" y="80" width="50" height="2" rx="1" fill="hsl(199 80% 50% / 0.3)" />

          {/* Кнопки */}
          <circle cx="220" cy="80" r="3" fill="hsl(222 24% 30%)" />
          <circle cx="232" cy="80" r="3" fill="hsl(222 24% 30%)" />

          {/* Слот вывода — щель в нижней части корпуса */}
          <rect x="92" y="138" width="136" height="6" rx="2" fill="hsl(222 30% 6%)" />
          <rect x="92" y="138" width="136" height="1" fill="hsl(0 0% 0% / 0.6)" />

          {/* Выходной лоток (пластиковая полочка под слотом) */}
          <path d="M 88 150 L 232 150 L 240 168 L 80 168 Z" fill="hsl(222 24% 18%)" stroke="hsl(var(--border))" />

          {/* Индикатор статуса — справа на корпусе */}
          <g>
            <circle cx="244" cy="80" r="3" fill="hsl(var(--success))">
              <animate attributeName="opacity" values="1;0.4;1" dur="1.6s" repeatCount="indefinite" />
            </circle>
            <circle cx="244" cy="80" r="3" fill="hsl(var(--success) / 0.4)">
              <animate attributeName="r" values="3;9;3" dur="2s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.7;0;0.7" dur="2s" repeatCount="indefinite" />
            </circle>
          </g>

          {/* Лист — обрезан растущей маской */}
          <g clipPath="url(#paper-area)">
            <rect x="100" y="144" width="120" height="60" rx="2" fill="url(#paper-g)" />
          </g>

          {/* Строки текста: каждая «печатается» у слота в свой момент,
              затем уезжает вниз вместе с бумагой (первая ушла дальше всех). */}
          <g clipPath="url(#paper-area)">
            {[
              { t: 0.00, finalY: 196, w: 100 },
              { t: 0.11, finalY: 184, w: 90 },
              { t: 0.22, finalY: 172, w: 100 },
              { t: 0.33, finalY: 160, w: 80 },
              { t: 0.44, finalY: 150, w: 60 },
            ].map((line, i) => {
              const tStart = line.t.toFixed(3);
              const tStartPlus = (line.t + 0.005).toFixed(3);
              return (
                <rect key={i} x={110} y={144} width={line.w} height="2" rx="1" fill="hsl(222 30% 55%)" opacity="0">
                  <animate
                    attributeName="opacity"
                    values="0;0;1;1;0"
                    keyTimes={`0;${tStart};${tStartPlus};0.92;1`}
                    dur="4s"
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="y"
                    values={`144;144;${line.finalY};${line.finalY};144`}
                    keyTimes={`0;${tStart};0.55;0.92;1`}
                    dur="4s"
                    repeatCount="indefinite"
                  />
                </rect>
              );
            })}
          </g>
        </svg>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2 text-xs">
        {[
          { l: "Тонер", v: "98%", c: "text-success" },
          { l: "Барабан", v: "OK", c: "text-success" },
          { l: "Замин", v: "нет", c: "text-success" },
        ].map((it) => (
          <div key={it.l} className="rounded-lg border border-border bg-bg/40 px-3 py-2">
            <div className="text-muted-fg">{it.l}</div>
            <div className={`mt-0.5 font-medium ${it.c}`}>{it.v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
