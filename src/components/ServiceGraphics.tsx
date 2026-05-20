"use client";
import { motion } from "framer-motion";

/**
 * Заправка — мини-визуализация бункера тонера, который наполняется
 * + капля сверху + индикатор уровня сбоку. Минималистично, в стилистике сайта.
 */
export function ServiceGraphicRefill() {
  return (
    <div className="relative w-full h-full max-h-[200px] flex items-center justify-center">
      <svg viewBox="0 0 220 180" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="refill-toner" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="hsl(199 100% 60%)" />
            <stop offset="1" stopColor="hsl(217 100% 65%)" />
          </linearGradient>
          <linearGradient id="refill-body" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="hsl(222 24% 22%)" />
            <stop offset="1" stopColor="hsl(222 24% 13%)" />
          </linearGradient>
          <clipPath id="refill-bunker">
            <rect x="62" y="60" width="96" height="80" rx="6" />
          </clipPath>
        </defs>

        {/* Падающая капля — тоновый поток */}
        <g>
          <rect x="108" y="20" width="4" height="32" rx="2" fill="url(#refill-toner)" opacity="0.7">
            <animate attributeName="y" values="20;36;20" dur="1.4s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0;0.9;0" dur="1.4s" repeatCount="indefinite" />
          </rect>
          <circle cx="110" cy="20" r="3" fill="hsl(199 100% 60%)" opacity="0">
            <animate attributeName="opacity" values="0;1;0" dur="1.4s" repeatCount="indefinite" />
          </circle>
        </g>

        {/* Корпус-бункер */}
        <rect x="60" y="58" width="100" height="84" rx="7" fill="url(#refill-body)" stroke="hsl(var(--border))" />

        {/* Наполнение */}
        <g clipPath="url(#refill-bunker)">
          <motion.rect
            x="62"
            width="96"
            fill="url(#refill-toner)"
            initial={{ height: 12, y: 128 }}
            whileInView={{ height: 70, y: 70 }}
            viewport={{ once: false }}
            transition={{ duration: 2.2, ease: "easeOut" }}
          />
          {/* Лёгкая «волна» сверху */}
          <motion.path
            d="M 62 68 Q 80 64 110 68 T 158 68 L 158 80 L 62 80 Z"
            fill="hsl(199 100% 70%)"
            opacity="0.4"
            initial={{ y: 60 }}
            whileInView={{ y: 0 }}
            transition={{ duration: 2.2, ease: "easeOut" }}
          >
            <animate attributeName="d" values="
              M 62 68 Q 80 64 110 68 T 158 68 L 158 80 L 62 80 Z;
              M 62 70 Q 80 66 110 70 T 158 66 L 158 80 L 62 80 Z;
              M 62 68 Q 80 64 110 68 T 158 68 L 158 80 L 62 80 Z
            " dur="3s" repeatCount="indefinite" />
          </motion.path>
        </g>

        {/* Окошко уровня */}
        <rect x="60" y="58" width="100" height="84" rx="7" fill="none" stroke="hsl(var(--border))" />

        {/* Индикатор сбоку */}
        <g transform="translate(178, 60)">
          <rect width="6" height="80" rx="3" fill="hsl(222 30% 12%)" stroke="hsl(var(--border))" />
          <motion.rect
            width="6" rx="3"
            fill="hsl(var(--success))"
            initial={{ y: 70, height: 10 }}
            whileInView={{ y: 6, height: 74 }}
            transition={{ duration: 2.2, ease: "easeOut", delay: 0.2 }}
          />
          <text x="-2" y="-3" fontSize="7" fill="hsl(var(--muted-fg))" className="font-mono">100%</text>
        </g>

        {/* Подпись */}
        <text x="32" y="70" fontSize="9" fill="hsl(var(--muted-fg))" className="font-mono uppercase tracking-wider" transform="rotate(-90 32 70)">TONER</text>
      </svg>
    </div>
  );
}

/**
 * Ремонт — стилизованный «принтер в разборе»:
 * корпус с подсвеченными точками-проблемами + расходящиеся линии-выноски.
 */
export function ServiceGraphicRepair() {
  const hotspots = [
    { x: 80, y: 60, label: "Термоплёнка", delay: 0 },
    { x: 145, y: 60, label: "Ролик подачи", delay: 0.3 },
    { x: 120, y: 110, label: "Плата", delay: 0.6 },
    { x: 70, y: 110, label: "Шестерни", delay: 0.9 },
  ];

  return (
    <div className="relative w-full h-full max-h-[200px] flex items-center justify-center">
      <svg viewBox="0 0 220 180" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="repair-body" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="hsl(222 24% 22%)" />
            <stop offset="1" stopColor="hsl(222 24% 12%)" />
          </linearGradient>
        </defs>

        {/* Корпус принтера */}
        <rect x="40" y="40" width="140" height="100" rx="8" fill="url(#repair-body)" stroke="hsl(var(--border))" />
        <rect x="50" y="50" width="120" height="36" rx="4" fill="hsl(222 30% 10%)" stroke="hsl(var(--border))" />

        {/* Тонкая «техническая» разметка */}
        <line x1="40" y1="90" x2="180" y2="90" stroke="hsl(var(--border))" strokeDasharray="2 4" />
        <line x1="110" y1="40" x2="110" y2="140" stroke="hsl(var(--border))" strokeDasharray="2 4" />

        {/* Точки-проблемы */}
        {hotspots.map((h, i) => (
          <g key={i}>
            {/* Пульсирующее кольцо */}
            <circle cx={h.x} cy={h.y} r="3" fill="hsl(var(--accent))">
              <animate attributeName="opacity" values="1;0.4;1" dur="2s" begin={`${h.delay}s`} repeatCount="indefinite" />
            </circle>
            <circle cx={h.x} cy={h.y} r="3" fill="hsl(var(--accent) / 0.4)">
              <animate attributeName="r" values="3;10;3" dur="2s" begin={`${h.delay}s`} repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.7;0;0.7" dur="2s" begin={`${h.delay}s`} repeatCount="indefinite" />
            </circle>
          </g>
        ))}

        {/* Бумага */}
        <rect x="80" y="135" width="60" height="20" rx="2" fill="hsl(0 0% 95%)" opacity="0.85" />
        <line x1="86" y1="143" x2="134" y2="143" stroke="hsl(222 30% 60%)" strokeWidth="1.5" />
        <line x1="86" y1="148" x2="120" y2="148" stroke="hsl(222 30% 60%)" strokeWidth="1.5" />

        {/* Индикатор состояния */}
        <g transform="translate(166, 55)">
          <circle cx="0" cy="0" r="3" fill="hsl(var(--warning))">
            <animate attributeName="opacity" values="1;0.3;1" dur="1.2s" repeatCount="indefinite" />
          </circle>
          <text x="6" y="3" fontSize="7" fill="hsl(var(--warning))" className="font-mono">DIAG</text>
        </g>
      </svg>
    </div>
  );
}
