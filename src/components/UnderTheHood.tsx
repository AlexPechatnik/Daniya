"use client";
import { Reveal, RevealStagger, RevealItem } from "./Reveal";
import { motion } from "framer-motion";

export function UnderTheHood() {
  return (
    <section className="container py-20 lg:py-28">
      <Reveal>
        <div className="flex items-end justify-between gap-6 flex-wrap mb-12">
          <div>
            <div className="chip mb-4"><span className="font-mono text-primary">04</span> Как это устроено</div>
            <h2 className="heading-display text-4xl md:text-5xl lg:text-6xl max-w-3xl">
              Сервис, в котором<br /><span className="text-gradient">мы разбираемся</span>
            </h2>
          </div>
          <p className="text-muted-fg max-w-md leading-relaxed">
            Несколько фактов, которыми мы пользуемся каждый день — а вы можете использовать, чтобы понять, что именно ломается у вашего принтера.
          </p>
        </div>
      </Reveal>

      <RevealStagger className="grid gap-4 md:grid-cols-3 auto-rows-[280px] md:auto-rows-[300px]">
        {/* Card 1: Анатомия картриджа — LARGE */}
        <RevealItem className="md:row-span-2 md:col-span-1">
          <InfoCard label="01 · Анатомия картриджа" title="Что внутри лазерного картриджа">
            <CartridgeAnatomy />
            <div className="mt-3 text-xs text-muted-fg leading-relaxed">
              Каждый узел изнашивается со своей скоростью. Знаем какой именно дефект даёт каждый из них.
            </div>
          </InfoCard>
        </RevealItem>

        {/* Card 2: Линейка дефектов */}
        <RevealItem>
          <InfoCard label="02 · Диагностика" title="Линейка повторов">
            <DefectRuler />
          </InfoCard>
        </RevealItem>

        {/* Card 3: Цикл заправок */}
        <RevealItem>
          <InfoCard label="03 · Ресурс" title="Цикл заправок">
            <RefillCycle />
          </InfoCard>
        </RevealItem>

        {/* Card 4: Тайминг визита — LARGE */}
        <RevealItem className="md:row-span-2 md:col-span-1">
          <InfoCard label="04 · Скорость" title="Заправка на месте против подмены">
            <TimingComparison />
            <div className="mt-3 text-xs text-muted-fg leading-relaxed">
              Если каждая минута без печати дороже — выбирайте подмену. По цене одинаково.
            </div>
          </InfoCard>
        </RevealItem>

        {/* Card 5: Подменный фонд */}
        <RevealItem>
          <InfoCard label="05 · Фонд" title="Готовые модели">
            <StockGrid />
          </InfoCard>
        </RevealItem>

        {/* Card 6: Большая цифра */}
        <RevealItem>
          <InfoCard label="06 · Гарантия" title="Дней гарантии">
            <BigStat value="30" unit="дней" sub="на работы и расходник" />
          </InfoCard>
        </RevealItem>
      </RevealStagger>
    </section>
  );
}

// ──────────────────────────────────────────────────────────────────────────────

function InfoCard({ label, title, children }: { label: string; title: string; children: React.ReactNode }) {
  return (
    <div className="card h-full p-5 lg:p-6 flex flex-col relative overflow-hidden group">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
      <div className="relative flex-1 flex flex-col">
        <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-fg">{label}</div>
        <div className="mt-1 font-semibold tracking-tight">{title}</div>
        <div className="mt-4 flex-1">{children}</div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// 1. Cartridge anatomy

function CartridgeAnatomy() {
  const parts = [
    { id: "drum", label: "Фотобарабан", x: 75, color: "var(--primary)" },
    { id: "pcr", label: "Ролик заряда", x: 95, color: "var(--accent)" },
    { id: "mag", label: "Магнитный вал", x: 145, color: "#fbbf24" },
    { id: "blade", label: "Лезвие очистки", x: 105, color: "#34d399" },
    { id: "toner", label: "Бункер тонера", x: 175, color: "#a78bfa" },
  ];
  return (
    <div className="relative h-full flex flex-col">
      <svg viewBox="0 0 240 140" className="w-full" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="cart-body" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="hsl(222 24% 22%)" />
            <stop offset="1" stopColor="hsl(222 24% 13%)" />
          </linearGradient>
        </defs>
        {/* Корпус */}
        <rect x="20" y="40" width="200" height="70" rx="8" fill="url(#cart-body)" stroke="hsl(var(--border))" />
        {/* Бункер тонера справа */}
        <rect x="150" y="50" width="62" height="40" rx="4" fill="hsl(222 30% 11%)" />
        <text x="181" y="73" textAnchor="middle" className="fill-violet-400 font-mono" fontSize="9">TONER</text>

        {/* Магнитный вал */}
        <circle cx="145" cy="100" r="9" fill="hsl(222 24% 9%)" stroke="#fbbf24" strokeWidth="1.5">
          <animate attributeName="r" values="9;9.5;9" dur="3s" repeatCount="indefinite" />
        </circle>
        {/* Лезвие очистки */}
        <rect x="100" y="60" width="12" height="2.5" fill="#34d399" />
        {/* PCR — ролик заряда */}
        <circle cx="95" cy="95" r="7" fill="hsl(222 24% 11%)" stroke="hsl(var(--accent))" strokeWidth="1.5" />
        {/* Фотобарабан */}
        <circle cx="75" cy="100" r="15" fill="hsl(222 30% 15%)" stroke="hsl(var(--primary))" strokeWidth="2">
          <animateTransform attributeName="transform" type="rotate" from="0 75 100" to="360 75 100" dur="6s" repeatCount="indefinite" />
        </circle>
        <line x1="75" y1="85" x2="75" y2="95" stroke="hsl(var(--primary))" strokeWidth="1" opacity="0.5">
          <animateTransform attributeName="transform" type="rotate" from="0 75 100" to="360 75 100" dur="6s" repeatCount="indefinite" />
        </line>

        {/* Стрелочки подсказок */}
        {parts.map((p, i) => (
          <g key={p.id}>
            <line x1={p.x} y1={p.id === "toner" ? 38 : (p.id === "mag" ? 88 : (p.id === "pcr" ? 88 : (p.id === "blade" ? 58 : 85)))}
                  x2={p.x} y2={20 + i * 0}
                  stroke="hsl(var(--border))" strokeDasharray="2 2" />
          </g>
        ))}
      </svg>

      <div className="mt-3 grid grid-cols-2 gap-1.5 text-[10px]">
        <Legend dot="hsl(var(--primary))" label="Фотобарабан · 94 мм" />
        <Legend dot="hsl(var(--accent))" label="Ролик заряда (PCR)" />
        <Legend dot="#fbbf24" label="Магнитный вал" />
        <Legend dot="#34d399" label="Лезвие очистки" />
        <Legend dot="#a78bfa" label="Бункер тонера" />
      </div>
    </div>
  );
}

function Legend({ dot, label }: { dot: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-muted-fg">
      <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: dot }} />
      <span className="truncate">{label}</span>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// 2. Defect ruler — повторяющиеся дефекты

function DefectRuler() {
  const marks = [
    { mm: 38, label: "PCR", color: "hsl(var(--accent))" },
    { mm: 55, label: "Перенос", color: "#fbbf24" },
    { mm: 79, label: "Термоузел", color: "#f97316" },
    { mm: 94, label: "Барабан", color: "hsl(var(--primary))" },
  ];
  const maxMm = 100;

  return (
    <div className="flex flex-col h-full justify-center">
      <div className="relative pt-6 pb-10">
        {/* Ось */}
        <div className="relative h-px bg-border">
          {/* Маленькие тики */}
          {Array.from({ length: 11 }).map((_, i) => (
            <div key={i} className="absolute top-0 w-px h-1 bg-border" style={{ left: `${i * 10}%` }} />
          ))}
          {/* Цветные метки */}
          {marks.map((m, i) => (
            <motion.div
              key={m.mm}
              initial={{ opacity: 0, y: -8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 * i, duration: 0.4 }}
              className="absolute"
              style={{ left: `${(m.mm / maxMm) * 100}%`, transform: "translateX(-50%)" }}
            >
              <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] font-mono tabular-nums" style={{ color: m.color }}>
                {m.mm}мм
              </div>
              <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 h-3 w-0.5" style={{ background: m.color }} />
              <div className="absolute top-4 left-1/2 -translate-x-1/2 text-[9px] uppercase tracking-wider whitespace-nowrap" style={{ color: m.color }}>
                {m.label}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
      <div className="text-[10px] text-muted-fg leading-relaxed">
        Измеряем шаг повтора дефекта на отпечатке — узел определяется до разборки.
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// 3. Refill cycle — 1 → 5

function RefillCycle() {
  const stages = [1, 2, 3, 4, 5];
  return (
    <div className="flex flex-col h-full justify-center">
      <div className="flex items-center justify-between">
        {stages.map((n, i) => {
          const isOk = n <= 3;
          const isMaybe = n === 4;
          return (
            <div key={n} className="flex items-center flex-1 last:flex-none">
              <motion.div
                initial={{ scale: 0.6, opacity: 0 }}
                whileInView={{ scale: 1, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className={`relative h-9 w-9 rounded-full flex items-center justify-center text-xs font-mono font-semibold shrink-0
                  ${isOk ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40" : ""}
                  ${isMaybe ? "bg-warning/20 text-warning border border-warning/40" : ""}
                  ${!isOk && !isMaybe ? "bg-danger/20 text-danger border border-danger/40" : ""}`}
              >
                {n}
              </motion.div>
              {i < stages.length - 1 && (
                <div className="flex-1 h-px bg-border mx-1" />
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2 text-[10px]">
        <div>
          <div className="text-emerald-400 font-semibold">1–3</div>
          <div className="text-muted-fg">отлично</div>
        </div>
        <div>
          <div className="text-warning font-semibold">4</div>
          <div className="text-muted-fg">с риском</div>
        </div>
        <div>
          <div className="text-danger font-semibold">5+</div>
          <div className="text-muted-fg">пора менять</div>
        </div>
      </div>
      <div className="mt-3 text-[10px] text-muted-fg leading-relaxed">
        Средний ресурс лезвия и барабана — 3–5 циклов.
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// 4. Timing comparison — bar chart

function TimingComparison() {
  const segments = [
    { label: "Заявка", min: 0, color: "hsl(var(--muted-fg))" },
    { label: "Подтверждение", min: 15, color: "hsl(var(--primary))" },
    { label: "Выезд", min: 45, color: "hsl(var(--accent))" },
    { label: "Печать", min: 25, color: "#34d399" },
  ];
  const total = segments.reduce((s, x) => s + x.min, 0);

  return (
    <div className="space-y-4 mt-1">
      {/* Заправка на месте */}
      <div>
        <div className="flex items-baseline justify-between mb-2">
          <div className="text-xs font-medium">Заправка на месте</div>
          <div className="text-xs text-muted-fg font-mono tabular-nums">~{total + 30} мин</div>
        </div>
        <div className="flex h-3 rounded-full overflow-hidden border border-border">
          {[...segments, { label: "Заправка", min: 30, color: "#fbbf24" }].map((s, i) => (
            <motion.div
              key={i}
              initial={{ width: 0 }}
              whileInView={{ width: `${(s.min / (total + 30)) * 100}%` }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.6 }}
              style={{ background: s.color }}
              title={`${s.label} · ${s.min} мин`}
            />
          ))}
        </div>
      </div>

      {/* Подмена */}
      <div>
        <div className="flex items-baseline justify-between mb-2">
          <div className="text-xs font-medium flex items-center gap-1.5">
            Подмена <span className="text-[9px] uppercase tracking-wider text-primary font-mono">быстрее</span>
          </div>
          <div className="text-xs text-muted-fg font-mono tabular-nums">~{total + 5} мин</div>
        </div>
        <div className="flex h-3 rounded-full overflow-hidden border border-border">
          {[...segments, { label: "Подмена", min: 5, color: "hsl(var(--primary))" }].map((s, i) => (
            <motion.div
              key={i}
              initial={{ width: 0 }}
              whileInView={{ width: `${(s.min / (total + 5)) * 100}%` }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 + 0.3, duration: 0.6 }}
              style={{ background: s.color }}
            />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 pt-2">
        {segments.slice(1).map((s) => (
          <Legend key={s.label} dot={s.color} label={`${s.label} · ${s.min} мин`} />
        ))}
        <Legend dot="#fbbf24" label="Заправка · 30 мин" />
        <Legend dot="hsl(var(--primary))" label="Подмена · 5 мин" />
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// 5. Stock grid — подменный фонд

function StockGrid() {
  const stock = [
    { model: "HP CF283A", count: 8 },
    { model: "Canon 725", count: 6 },
    { model: "HP CE285A", count: 5 },
    { model: "Samsung MLT-D111S", count: 4 },
    { model: "Canon 737", count: 3 },
    { model: "Brother TN-1075", count: 2 },
  ];
  return (
    <div className="flex flex-col h-full">
      <div className="grid grid-cols-2 gap-1.5 text-[10px]">
        {stock.map((s, i) => (
          <motion.div
            key={s.model}
            initial={{ opacity: 0, y: 6 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.05 }}
            className="rounded-md border border-border bg-bg/40 px-2 py-1.5 flex items-center justify-between"
          >
            <span className="font-mono text-fg/80 truncate">{s.model}</span>
            <span className="text-primary font-semibold tabular-nums">{s.count}</span>
          </motion.div>
        ))}
      </div>
      <div className="mt-auto pt-3 text-[10px] text-muted-fg leading-relaxed">
        Самые ходовые — всегда в наличии для подмены.
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// 6. Big stat

function BigStat({ value, unit, sub }: { value: string; unit: string; sub: string }) {
  return (
    <div className="flex flex-col h-full justify-center">
      <div className="flex items-baseline gap-2">
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          whileInView={{ scale: 1, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-6xl md:text-7xl font-semibold tracking-tightest text-gradient tabular-nums"
        >
          {value}
        </motion.div>
        <div className="text-sm text-muted-fg">{unit}</div>
      </div>
      <div className="mt-3 text-xs text-muted-fg leading-relaxed">{sub}</div>
      {/* Decorative bar */}
      <div className="mt-4 h-1 rounded-full bg-muted overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          whileInView={{ width: "100%" }}
          viewport={{ once: true }}
          transition={{ duration: 1.2, delay: 0.3 }}
          className="h-full bg-gradient-to-r from-primary to-accent"
        />
      </div>
    </div>
  );
}
