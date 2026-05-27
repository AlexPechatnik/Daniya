"use client";

/**
 * iOS Segmented Control: ровный pill-row с soft-tint активного.
 * Подходит для переключения между табами на одной странице (Карточка/Чат/...).
 */
export function MobileTabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { value: T; label: string; badge?: number }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="inline-flex w-full rounded-xl bg-bg-2/60 p-1 text-sm">
      {tabs.map((t) => {
        const active = value === t.value;
        return (
          <button
            key={t.value}
            type="button"
            onClick={() => onChange(t.value)}
            className={`flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 transition ${
              active ? "bg-card text-fg shadow-sm" : "text-muted-fg hover:text-fg"
            }`}
          >
            <span>{t.label}</span>
            {t.badge !== undefined && t.badge > 0 && (
              <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-none text-white">
                {t.badge > 99 ? "99+" : t.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
