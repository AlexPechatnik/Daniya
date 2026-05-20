import Link from "next/link";
import { Logo } from "./Logo";
import { ArrowUpRight, MapPin, MessageCircle, Phone, Mail } from "lucide-react";
import { company } from "@/lib/company";
import { publicBotLinks } from "@/lib/publicBotLinks";

export function Footer() {
  const botLinks = publicBotLinks();

  return (
    <footer className="mt-20 border-t border-border relative overflow-hidden">
      <div aria-hidden className="absolute inset-0 bg-grid mask-fade-bottom opacity-30" />
      <div className="container relative grid gap-10 py-16 md:grid-cols-12">
        <div className="md:col-span-5">
          <Logo />
          <p className="mt-5 text-sm text-muted-fg max-w-md leading-relaxed">
            Выездной сервис принтеров в Санкт-Петербурге: заправка, замена, диагностика, ремонт. Работаем с физлицами и организациями.
          </p>
          <Link href="/#request" className="btn-outline mt-6">
            Оставить заявку <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
        <Col title="Услуги" links={[
          { href: "/services/zapravka", label: "Заправка картриджей" },
          { href: "/services/zamena", label: "Замена картриджей" },
          { href: "/services/diagnostika", label: "Диагностика" },
          { href: "/services/remont", label: "Ремонт принтеров" },
        ]} className="md:col-span-3" />
        <Col title="Информация" links={[
          { href: "/corporate", label: "Корпоративным" },
          { href: "/price", label: "Прайс" },
          { href: "/problems", label: "Типовые проблемы" },
          { href: "/about", label: "О компании" },
        ]} className="md:col-span-2" />
        <div className="md:col-span-2">
          <div className="text-xs uppercase tracking-wider text-muted-fg mb-4">Контакты</div>
          <ul className="space-y-3 text-sm">
            <li className="flex gap-2.5">
              <MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <div>
                <div>{company.city}</div>
                <div className="text-muted-fg text-xs leading-relaxed">{company.address}</div>
              </div>
            </li>
            <li className="flex gap-2.5">
              <Phone className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <a href={`tel:${company.phoneTel}`} className="hover:text-primary">{company.phone}</a>
            </li>
            <li className="flex gap-2.5">
              <Mail className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <a href={`mailto:${company.email}`} className="hover:text-primary">{company.email}</a>
            </li>
            {botLinks.map((bot) => (
              <li key={bot.key} className="flex gap-2.5">
                <MessageCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <a href={bot.href} target="_blank" rel="noreferrer" className="hover:text-primary">
                  Написать в {bot.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="relative border-t border-border">
        <div className="container py-6 text-xs text-muted-fg flex flex-wrap justify-between gap-3">
          <span>© {new Date().getFullYear()} {company.name}. Все цены ориентировочные.</span>
          <span className="font-mono">v1.0 · СПб</span>
        </div>
      </div>
    </footer>
  );
}

function Col({ title, links, className }: { title: string; links: { href: string; label: string }[]; className?: string }) {
  return (
    <div className={className}>
      <div className="text-xs uppercase tracking-wider text-muted-fg mb-4">{title}</div>
      <ul className="space-y-2 text-sm">
        {links.map((l) => (
          <li key={l.href}><Link href={l.href} className="text-fg/80 hover:text-fg transition">{l.label}</Link></li>
        ))}
      </ul>
    </div>
  );
}
