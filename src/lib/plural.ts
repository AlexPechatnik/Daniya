/**
 * Русское склонение числительных: 1 позиция / 2 позиции / 5 позиций.
 * forms[0] — для 1 (21, 31, …)
 * forms[1] — для 2..4 (22, 23, 24, …)
 * forms[2] — для 0, 5..20, 25..30 …
 */
export function plural(n: number, forms: [string, string, string]): string {
  const abs = Math.abs(n) | 0;
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  if (mod100 >= 11 && mod100 <= 14) return forms[2];
  if (mod10 === 1) return forms[0];
  if (mod10 >= 2 && mod10 <= 4) return forms[1];
  return forms[2];
}

/** `1 позиция`, `2 позиции`, `137 позиций`. */
export function positions(n: number): string {
  return `${n} ${plural(n, ["позиция", "позиции", "позиций"])}`;
}

/** `1 картридж`, `2 картриджа`, `137 картриджей`. */
export function cartridges(n: number): string {
  return `${n} ${plural(n, ["картридж", "картриджа", "картриджей"])}`;
}

/** `1 услуга`, `2 услуги`, `5 услуг`. */
export function servicesCount(n: number): string {
  return `${n} ${plural(n, ["услуга", "услуги", "услуг"])}`;
}

/** `1 модель`, `2 модели`, `138 моделей`. */
export function models(n: number): string {
  return `${n} ${plural(n, ["модель", "модели", "моделей"])}`;
}
