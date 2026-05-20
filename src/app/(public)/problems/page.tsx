import Link from "next/link";
import type { Metadata } from "next";
import { Reveal, RevealStagger, RevealItem } from "@/components/Reveal";
import { ArrowUpRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Решение типовых проблем с принтерами — самоучитель",
  description: "Что делать, если принтер печатает с полосами, бледно, мажет, жуёт бумагу, не видит картридж, выдаёт чистые листы. Технические причины и пошаговая диагностика.",
};

type Item = { slug: string; title: string; desc: string };
type Group = { title: string; items: Item[] };

const groups: Group[] = [
  {
    title: "Качество печати",
    items: [
      { slug: "polosy", title: "Принтер печатает с полосами", desc: "Чёрные, светлые или цветные полосы — диагностика по шагу повторения." },
      { slug: "bledno", title: "Печатает бледно", desc: "Слабый текст, низкий контраст — тонер, магнитный вал, термоузел." },
      { slug: "gryazno", title: "Картридж мажет, пятна и фон", desc: "Грязная печать, фон, переполненный отстойник, износ лезвия." },
      { slug: "povtor-defekt", title: "Повторяющиеся дефекты", desc: "Точки, штрихи, тени через равные промежутки — определение по линейке." },
      { slug: "otslaivaetsya-toner", title: "Тонер стирается пальцем", desc: "Печать осыпается с листа — диагностика термоузла." },
      { slug: "prizraki-ghosting", title: "Призраки, двойная печать", desc: "Бледный отпечаток предыдущей строки — ghosting, offsetting." },
      { slug: "belye-listy", title: "Принтер печатает пустые листы", desc: "Чистая бумага из лотка — частые причины и проверка." },
    ],
  },
  {
    title: "Картридж и расходники",
    items: [
      { slug: "ne-vidit-kartridzh", title: "Принтер не видит картридж", desc: "Ошибка картриджа, чипы, прошивки HP/Canon." },
      { slug: "oshibka-kartridzha", title: "Ошибка картриджа после прошивки", desc: "HP/Canon заблокировали совместимый — что делать." },
      { slug: "toner-zakonchilsya", title: "Закончился тонер", desc: "Как определить ресурс и не путать с другими дефектами." },
    ],
  },
  {
    title: "Подача бумаги и механика",
    items: [
      { slug: "ne-zahvatyvaet-bumagu", title: "Принтер не захватывает бумагу", desc: "Ролик подачи, тормозная площадка, чистка резинки." },
      { slug: "zhuet-bumagu", title: "Принтер жуёт бумагу", desc: "Замина, износ роликов, узел дуплекса." },
    ],
  },
  {
    title: "Струйные принтеры",
    items: [
      { slug: "zasohli-sopla", title: "Засохли сопла печатающей головки", desc: "Epson/Canon — прочистка, замачивание, восстановление." },
    ],
  },
];

export default function Page() {
  return (
    <section className="container py-16 lg:py-24">
      <Reveal>
        <Link href="/" className="chip mb-6 hover:text-fg transition">← На главную</Link>
        <h1 className="heading-display text-4xl md:text-5xl lg:text-6xl max-w-3xl">
          Типовые проблемы<br /><span className="text-gradient">и подробные решения</span>
        </h1>
        <p className="mt-5 text-muted-fg max-w-2xl leading-relaxed">
          Что можно проверить самому, какие инструменты понадобятся, чего делать нельзя и когда дешевле сразу вызвать мастера. Технические разборы — не пересказы из википедии.
        </p>
      </Reveal>

      <div className="mt-14 space-y-14">
        {groups.map((g) => (
          <div key={g.title}>
            <Reveal>
              <h2 className="text-sm font-mono uppercase tracking-[0.2em] text-muted-fg mb-5">{g.title}</h2>
            </Reveal>
            <RevealStagger className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {g.items.map((p) => (
                <RevealItem key={p.slug}>
                  <Link href={`/problems/${p.slug}`} className="card-interactive group p-6 block h-full">
                    <div className="flex items-start justify-between gap-3">
                      <div className="font-semibold">{p.title}</div>
                      <ArrowUpRight className="h-5 w-5 text-muted-fg group-hover:text-primary group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition shrink-0" />
                    </div>
                    <div className="mt-2 text-sm text-muted-fg leading-relaxed">{p.desc}</div>
                  </Link>
                </RevealItem>
              ))}
            </RevealStagger>
          </div>
        ))}
      </div>
    </section>
  );
}
