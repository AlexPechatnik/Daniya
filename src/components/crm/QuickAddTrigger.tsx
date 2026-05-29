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
      // Хоткей на «Новую заявку» убран: Ctrl+K теперь поиск (CrmTopBar),
      // Ctrl+N перехватывает браузер (новое окно). Кнопка «+» в шапке
      // и плавающая кнопка на мобайле достаточны.
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
        // На мобайле кнопка «+» только плавающая (variant="fab"), здесь только десктоп.
        <button onClick={openManually} className="btn-primary hidden md:inline-flex">
          <Plus className="h-4 w-4" />
          Новая заявка
        </button>
      ) : null /* variant="fab" больше ничего не рендерит:
          на мобайле «+» переехал в CrmTopBar (см. MobileQuickAdd),
          модалку всё равно открывает этот же компонент через event-bus. */}
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
