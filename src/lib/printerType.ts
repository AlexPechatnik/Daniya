/**
 * Тип принтера — определяем по полю `kind` из каталога ТОП-100.
 * Для струйных моделей мы не ведём картриджи как расходник: цена
 * не считается «по чернилам», заявка идёт через диагностику/обслуживание.
 *
 *   laser  — лазерный принтер/МФУ: cartridge-based прайс (заправка, замена, чип)
 *   inkjet — струйный: услуги-сервисы, цена уточняется после диагностики
 */
export type PrintType = "laser" | "inkjet";

export function detectPrintType(kind?: string | null): PrintType {
  const k = (kind || "").toLowerCase();
  if (!k) return "laser"; // безопасный дефолт — без kind считаем лазером
  if (k.includes("струй") || k.includes("ecotank") || k.includes("ink") || k.includes("снпч")) {
    return "inkjet";
  }
  return "laser";
}

/**
 * Slug-и услуг, которые мы предлагаем для струйных принтеров.
 * Источник правды — таблица Service в БД; здесь храним только порядок и
 * человечный комментарий, что это за услуга.
 */
export const INKJET_SERVICE_SLUGS = [
  "inkjet-diagnostics",
  "head-cleaning",
  "head-flush",
  "ciss-service",
  "ciss-install",
  "ink-system-service",
  "waste-ink-reset",
  "print-quality-setup",
  "inkjet-repair",
  "paper-feed",
] as const;

/** Главная рекомендуемая услуга для нового струйного клиента. */
export const INKJET_DEFAULT_SLUG = "inkjet-diagnostics";

/** Подзаголовок-объяснение для UI: почему цены струйки «от» и «уточняется». */
export const INKJET_PRICING_NOTE =
  "Цена зависит от состояния печатающей головки, СНПЧ и результата диагностики. Уточняется мастером на месте.";
