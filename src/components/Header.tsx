"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Logo } from "./Logo";
import { MessageCircle, Phone, Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { company } from "@/lib/company";
import { primaryBotLink, publicBotLinks } from "@/lib/publicBotLinks";

const nav = [
  { href: "/services/zapravka", label: "Заправка" },
  { href: "/services/zamena", label: "Замена" },
  { href: "/services/diagnostika", label: "Диагностика" },
  { href: "/services/remont", label: "Ремонт" },
  { href: "/corporate", label: "Бизнесу" },
  { href: "/price", label: "Прайс" },
  { href: "/problems", label: "Решения" },
];

export function Header() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const botLinks = publicBotLinks();
  const primaryBot = primaryBotLink();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <header
        className={`sticky top-0 z-40 transition-all duration-300 ${
          scrolled ? "border-b border-border bg-bg/80 backdrop-blur-xl" : "bg-transparent"
        }`}
      >
        <div className="container flex h-16 items-center justify-between gap-6">
          <Logo />

          <nav className="hidden lg:flex items-center gap-0.5 text-sm">
            {nav.map((n) => (
              <Link key={n.href} href={n.href} className="px-3 py-2 rounded-lg text-muted-fg hover:text-fg hover:bg-muted/60 transition">
                {n.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <a href={`tel:${company.phoneTel}`} className="btn-ghost hidden md:inline-flex">
              <Phone className="h-4 w-4" />
              <span className="hidden xl:inline">{company.phone}</span>
            </a>
            {primaryBot && (
              <a href={primaryBot.href} target="_blank" rel="noreferrer" className="btn-outline hidden md:inline-flex">
                <MessageCircle className="h-4 w-4" />
                <span className="hidden xl:inline">Написать</span>
              </a>
            )}
            <Link href="/#request" className="btn-primary">
              <span className="relative h-1.5 w-1.5 rounded-full bg-white">
                <span className="absolute inset-0 rounded-full bg-white animate-ping opacity-75" />
              </span>
              Заявка
            </Link>
            <button onClick={() => setOpen(true)} className="btn-ghost lg:hidden p-2" aria-label="Меню">
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-bg/95 backdrop-blur-xl lg:hidden"
          >
            <div className="container flex h-16 items-center justify-between">
              <Logo />
              <button onClick={() => setOpen(false)} className="btn-ghost p-2"><X className="h-5 w-5" /></button>
            </div>
            <nav className="container mt-6 flex flex-col gap-1">
              {nav.map((n, i) => (
                <motion.div key={n.href} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.04 * i }}>
                  <Link href={n.href} onClick={() => setOpen(false)} className="block py-3 text-2xl font-medium tracking-tight border-b border-border">
                    {n.label}
                  </Link>
                </motion.div>
              ))}
            </nav>
            <div className="container mt-8 space-y-3">
              <a href={`tel:${company.phoneTel}`} className="btn-outline w-full justify-center text-base py-3">
                <Phone className="h-4 w-4" /> {company.phone}
              </a>
              {botLinks.map((bot) => (
                <a
                  key={bot.key}
                  href={bot.href}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-outline w-full justify-center text-base py-3"
                >
                  <MessageCircle className="h-4 w-4" /> Написать в {bot.label}
                </a>
              ))}
              <Link onClick={() => setOpen(false)} href="/#request" className="btn-primary w-full justify-center text-base py-3">Оставить заявку</Link>
            </div>
            <div className="container mt-6 text-xs text-muted-fg">
              Офис: {company.address}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
