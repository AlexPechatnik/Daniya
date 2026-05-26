/**
 * Тип принтера: laser | inkjet.
 *
 * Раньше определялся regex по строке kind. Теперь источник правды —
 * поле `PrinterModel.printType` в БД, которое CRM может редактировать
 * через xlsx-импорт. Функция ниже — фолбэк-эвристика для случаев, когда
 * мы знаем только текстовое описание (например, новый принтер из Яндекса).
 */
export type PrintType = "laser" | "inkjet";

export function detectPrintType(kind?: string | null): PrintType {
  const k = (kind || "").toLowerCase();
  if (!k) return "laser";
  if (k.includes("струй") || k.includes("ecotank") || k.includes("ink") || k.includes("снпч")) {
    return "inkjet";
  }
  return "laser";
}

/** Slug услуги-диагностики струйного — единственное «именованное» значение,
 * на которое ссылается код (для дефолтного выбора в форме заявки).
 * Если такой услуги нет в БД, форма берёт первую с appliesTo=inkjet. */
export const INKJET_DEFAULT_SLUG = "inkjet-diagnostics";
