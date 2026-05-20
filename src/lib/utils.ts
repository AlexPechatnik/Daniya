import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRub(kopecks: number | null | undefined) {
  if (kopecks == null) return "—";
  const rub = Math.round(kopecks / 100);
  return new Intl.NumberFormat("ru-RU").format(rub) + " ₽";
}

export function normalizePhone(input: string) {
  const d = input.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("8")) return "+7" + d.slice(1);
  if (d.length === 11 && d.startsWith("7")) return "+" + d;
  if (d.length === 10) return "+7" + d;
  return "+" + d;
}
