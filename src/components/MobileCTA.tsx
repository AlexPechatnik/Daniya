"use client";
import { MessageCircle, Phone, Send } from "lucide-react";
import Link from "next/link";
import { company } from "@/lib/company";
import { primaryBotLink } from "@/lib/publicBotLinks";

export function MobileCTA() {
  const bot = primaryBotLink();

  return (
    <div className="fixed bottom-0 inset-x-0 z-30 lg:hidden p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className={`glass rounded-2xl border border-border p-2 grid ${bot ? "grid-cols-3" : "grid-cols-2"} gap-2 shadow-2xl shadow-black/40`}>
        <a href={`tel:${company.phoneTel}`} className="btn-outline justify-center py-3">
          <Phone className="h-4 w-4" />
          <span className="hidden min-[380px]:inline">Позвонить</span>
          <span className="min-[380px]:hidden">Звонок</span>
        </a>
        {bot && (
          <a href={bot.href} target="_blank" rel="noreferrer" className="btn-outline justify-center py-3">
            <MessageCircle className="h-4 w-4" /> Бот
          </a>
        )}
        <Link href="/#request" className="btn-primary justify-center py-3">
          <Send className="h-4 w-4" /> Заявка
        </Link>
      </div>
    </div>
  );
}
