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
        <button onClick={() => setOpen(true)} className="btn-primary hidden md:inline-flex">
          <Plus className="h-4 w-4" />
          Новая заявка
          <kbd className="hidden lg:inline ml-2 text-[10px] opacity-70">Ctrl+K</kbd>
        </button>
      ) : (
        <button
          onClick={() => setOpen(true)}
          aria-label="Новая заявка"
          className="md:hidden fixed bottom-5 right-5 z-40 h-14 w-14 rounded-full btn-primary btn-glow !p-0 shadow-2xl shadow-primary/40 active:scale-95 transition-transform"
        >
          <Plus className="h-6 w-6" />
        </button>
      )}
      {open && <QuickAddModal onClose={() => setOpen(false)} services={services} masters={masters} />}
    </>
  );
}
