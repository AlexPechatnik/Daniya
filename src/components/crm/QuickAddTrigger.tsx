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

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      {variant === "header" ? (
        <>
          {/* На десктопе — полноценная кнопка с подписью */}
          <button onClick={() => setOpen(true)} className="btn-primary hidden md:inline-flex">
            <Plus className="h-4 w-4" />
            Новая заявка
            <kbd className="hidden lg:inline ml-2 text-[10px] opacity-70">Ctrl+K</kbd>
          </button>
          {/* На мобиле — компактная иконка в шапке, чтобы кнопка была под рукой
              даже если FAB закрыт диалогами или клавиатурой */}
          <button
            onClick={() => setOpen(true)}
            aria-label="Новая заявка"
            className="md:hidden h-10 w-10 rounded-full btn-primary !p-0 shadow-lg shadow-primary/30"
          >
            <Plus className="h-5 w-5" />
          </button>
        </>
      ) : (
        // FAB — поднят над нижней навигацией с учётом safe-area iPhone.
        // Нижняя нав: ~58px + safe-area-inset-bottom (~34px на iPhone с home-indicator).
        <button
          onClick={() => setOpen(true)}
          aria-label="Новая заявка"
          className="md:hidden fixed right-4 z-40 h-14 w-14 rounded-full btn-primary btn-glow !p-0 shadow-2xl shadow-primary/40 active:scale-95 transition-transform"
          style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 5.25rem)" }}
        >
          <Plus className="h-6 w-6" />
        </button>
      )}
      {open && <QuickAddModal onClose={() => setOpen(false)} services={services} masters={masters} />}
    </>
  );
}
