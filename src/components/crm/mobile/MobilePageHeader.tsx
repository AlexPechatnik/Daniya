"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

/**
 * iOS-style шапка страницы: back-стрелка слева, title по центру, action справа.
 * Sticky к верху, полупрозрачная с blur — как в iOS Settings/Mail.
 */
export function MobilePageHeader({
  backHref,
  onBack,
  title,
  subtitle,
  action,
}: {
  backHref?: string;
  onBack?: () => void;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-20 -mx-4 -mt-4 mb-4 flex h-14 items-center gap-2 border-b border-border bg-card/85 px-3 backdrop-blur lg:hidden">
      {backHref ? (
        <Link
          href={backHref}
          aria-label="Назад"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-primary hover:bg-primary/10"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
      ) : onBack ? (
        <button
          type="button"
          onClick={onBack}
          aria-label="Назад"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-primary hover:bg-primary/10"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
      ) : (
        <span className="w-9" aria-hidden />
      )}

      <div className="min-w-0 flex-1 text-center">
        <div className="truncate text-sm font-semibold">{title}</div>
        {subtitle && <div className="truncate text-[11px] text-muted-fg">{subtitle}</div>}
      </div>

      <div className="w-9 shrink-0">{action}</div>
    </header>
  );
}
