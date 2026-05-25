export const PRICE_CATEGORIES = [
  {
    id: "visit_diagnostics",
    title: "Выезд и диагностика",
    description: "Выезд, первичная проверка, срочность и базовая оценка работ.",
    slugs: ["diagnostika", "inkjet-diagnostics"],
  },
  {
    id: "laser_refill",
    title: "Заправка лазерных картриджей",
    description: "Цена по модели картриджа, ресурсу и необходимости чипа.",
    slugs: ["zapravka"],
  },
  {
    id: "cartridge_replacement",
    title: "Замена картриджей",
    description: "Совместимый, оригинальный или готовый заправленный картридж.",
    slugs: ["zamena"],
  },
  {
    id: "printer_repair",
    title: "Ремонт принтеров",
    description: "Лазерные и струйные неисправности, подача бумаги, печка, узлы.",
    slugs: ["remont", "inkjet-repair", "paper-feed"],
  },
  {
    id: "ciss_inkjet_service",
    title: "СНПЧ и струйная печать",
    description: "СНПЧ, головка, промывка, памперс, система подачи чернил.",
    slugs: [
      "ciss-install",
      "ciss-service",
      "head-cleaning",
      "head-flush",
      "ink-system-service",
      "print-quality-setup",
      "waste-ink-reset",
    ],
  },
  {
    id: "maintenance",
    title: "Обслуживание",
    description: "Профилактика, чистка, настройка печати и договорное обслуживание.",
    slugs: [],
  },
] as const;

export type PriceCategoryId = (typeof PRICE_CATEGORIES)[number]["id"];

export function priceCategoryForSlug(slug: string) {
  return PRICE_CATEGORIES.find((category) => (category.slugs as readonly string[]).includes(slug)) ?? PRICE_CATEGORIES[5];
}
