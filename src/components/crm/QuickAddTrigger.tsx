"use client";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { QuickAddModal } from "./QuickAddModal";
import type { Service, User } from "@prisma/client";

type Variant = "header" | "fab";

export function QuickAddTrigger({
  services,
  masters,
  variant = "header",
}: {
  services: Service[];
  masters: User[];
  variant?: Variant;
}) {
  const [open, setOpen] = useState(false);
  // Время, переданное из календаря через CustomEvent — для предзаполнения
  const [initialScheduledAt, setInitialScheduledAt] = useState<string | undefined>(undefined);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setInitialScheduledAt(undefined);
        setOpen(true);
      }
      if (e.key === "Escape") setOpen(false);
    }
    function onQuickAdd(e: Event) {
      // Календарь дёргает window.dispatchEvent("printcare:quickadd", { detail: { scheduledAt }})
      const ce = e as CustomEvent<{ scheduledAt?: string }>;
      setInitialScheduledAt(ce.detail?.scheduledAt);
      setOpen(true);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("printcare:quickadd", onQuickAdd as EventListener);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("printcare:quickadd", onQuickAdd as EventListener);
    };
  }, []);

  function openManually() {
    setInitialScheduledAt(undefined);
    setOpen(true);
  }

  return (
    <>
      {variant === "header" ? (
        <>
          <button onClick={openManually} className="btn-primary hidden md:inline-flex">
            <Plus className="h-4 w-4" />
            Новая заявка
            <kbd className="hidden lg:inline ml-2 text-[10px] opacity-70">Ctrl+K</kbd>
          </button>
          <button
            onClick={openManually}
            aria-label="Новая заявка"
            className="md:hidden h-10 w-10 rounded-full btn-primary !p-0 shadow-lg shadow-primary/30"
          >
            <Plus className="h-5 w-5" />
          </button>
        </>
      ) : (
        <button
          onClick={openManually}
          aria-label="Новая заявка"
          className="md:hidden fixed right-4 z-40 h-14 w-14 rounded-full btn-primary btn-glow !p-0 shadow-2xl shadow-primary/40 active:scale-95 transition-transform"
          style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 5.25rem)" }}
        >
          <Plus className="h-6 w-6" />
        </button>
      )}
      {open && (
        <QuickAddModal
          onClose={() => setOpen(false)}
          services={services}
          masters={masters}
          initialScheduledAt={initialScheduledAt}
        />
      )}
    </>
  );
}
