import Link from "next/link";

export function Logo({ className = "", compact = false }: { className?: string; compact?: boolean }) {
  return (
    <Link href="/" className={`flex items-center gap-2.5 group ${className}`}>
      <div className="relative">
        <svg viewBox="0 0 40 40" className="h-9 w-9 transition-transform group-hover:scale-105" fill="none" aria-hidden>
          <defs>
            <linearGradient id="lg-g" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="hsl(199 100% 60%)" />
              <stop offset="1" stopColor="hsl(217 100% 65%)" />
            </linearGradient>
          </defs>
          <rect x="2" y="2" width="36" height="36" rx="11" fill="url(#lg-g)" />
          <rect x="2" y="2" width="36" height="36" rx="11" stroke="hsl(0 0% 100% / 0.15)" />
          <path d="M11 15h18v8.5a2.5 2.5 0 0 1-2.5 2.5H26v-5.5H14V26h-.5A2.5 2.5 0 0 1 11 23.5V15z" fill="#fff" fillOpacity="0.96" />
          <rect x="14.5" y="9.5" width="11" height="5.5" rx="1.2" fill="#fff" fillOpacity="0.85" />
          <rect x="16" y="22" width="8" height="6.5" rx="1" fill="#fff" />
          <circle cx="25.5" cy="18.5" r="1.1" fill="hsl(152 76% 50%)" />
        </svg>
        <span className="absolute inset-0 rounded-[11px] -z-10 blur-md opacity-50 bg-gradient-to-br from-primary to-primary-2" />
      </div>
      {!compact && (
        <div className="leading-tight">
          <div className="font-semibold tracking-tight">PrintCare</div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-fg">СПб · сервис принтеров</div>
        </div>
      )}
    </Link>
  );
}
