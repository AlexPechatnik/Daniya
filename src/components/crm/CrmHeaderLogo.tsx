"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Логотип в CRM-шапке. Раньше вёл на публичный сайт — это сбивало
 * с толку: в рабочем приложении тап на лого должен переключать между
 * админом и режимом мастера, а не уводить на лендинг.
 *
 *   Админ на админских страницах   → /crm/mobile?tab=mine (режим мастера)
 *   Админ на /crm/mobile/*         → /crm (вернуться в админ)
 *   Мастер                          → /crm/mobile?tab=mine (свой домой)
 *
 * Публичный сайт открывается явно из меню «Ещё».
 */
export function CrmHeaderLogo({ userRole }: { userRole?: string }) {
  const pathname = usePathname() || "";
  const isAdmin = userRole === "ADMIN";
  const isMasterView = pathname.startsWith("/crm/mobile");

  let href = "/crm/mobile?tab=mine";
  let label = "Открыть как мастер";
  if (isAdmin && isMasterView) {
    href = "/crm";
    label = "Вернуться в админ-режим";
  } else if (isAdmin) {
    href = "/crm/mobile?tab=mine";
    label = "Открыть как мастер";
  }

  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className="flex items-center gap-2.5 group"
    >
      <div className="relative">
        <svg viewBox="0 0 40 40" className="h-9 w-9 transition-transform group-hover:scale-105 group-active:scale-95" fill="none" aria-hidden>
          <defs>
            <linearGradient id="crm-lg-g" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="hsl(199 100% 60%)" />
              <stop offset="1" stopColor="hsl(217 100% 65%)" />
            </linearGradient>
          </defs>
          <rect x="2" y="2" width="36" height="36" rx="11" fill="url(#crm-lg-g)" />
          <rect x="2" y="2" width="36" height="36" rx="11" stroke="hsl(0 0% 100% / 0.15)" />
          <path d="M11 15h18v8.5a2.5 2.5 0 0 1-2.5 2.5H26v-5.5H14V26h-.5A2.5 2.5 0 0 1 11 23.5V15z" fill="#fff" fillOpacity="0.96" />
          <rect x="14.5" y="9.5" width="11" height="5.5" rx="1.2" fill="#fff" fillOpacity="0.85" />
          <rect x="16" y="22" width="8" height="6.5" rx="1" fill="#fff" />
          <circle cx="25.5" cy="18.5" r="1.1" fill="hsl(152 76% 50%)" />
        </svg>
        <span className="absolute inset-0 rounded-[11px] -z-10 blur-md opacity-50 bg-gradient-to-br from-primary to-primary-2" />
      </div>
    </Link>
  );
}
