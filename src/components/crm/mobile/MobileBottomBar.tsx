"use client";

import type { ReactNode } from "react";

/**
 * Sticky-bar внизу мобильной страницы — для главного действия.
 * Учитывает safe-area iPhone и нижнюю CRM-навигацию (она fixed внизу).
 */
export function MobileBottomBar({ children }: { children: ReactNode }) {
  // Нижний CRM-таббар имеет высоту ~56px + safe-area. Ставим бар над ним.
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card/95 px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+72px)] backdrop-blur lg:hidden">
      {children}
    </div>
  );
}
