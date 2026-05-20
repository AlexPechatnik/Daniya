export type PublicBotLink = {
  key: "telegram" | "max";
  label: string;
  shortLabel: string;
  href: string;
};

export function publicBotLinks(): PublicBotLink[] {
  const telegram = telegramUrl();
  const max = maxUrl();
  return [
    telegram ? { key: "telegram" as const, label: "Telegram", shortLabel: "TG", href: telegram } : null,
    max ? { key: "max" as const, label: "Max", shortLabel: "Max", href: max } : null,
  ].filter((item): item is PublicBotLink => Boolean(item));
}

export function primaryBotLink() {
  return publicBotLinks()[0] || null;
}

function telegramUrl() {
  const direct = cleanUrl(process.env.NEXT_PUBLIC_TELEGRAM_BOT_URL);
  if (direct) return withTelegramStart(direct);
  const username = String(process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "").trim().replace(/^@/, "");
  if (!username) return "";
  return `https://t.me/${username}?start=site`;
}

function maxUrl() {
  const direct = cleanUrl(process.env.NEXT_PUBLIC_MAX_BOT_URL);
  if (direct) return direct;
  const username = String(process.env.NEXT_PUBLIC_MAX_BOT_USERNAME || "").trim().replace(/^@/, "");
  if (!username) return "";
  return `https://max.ru/${username}`;
}

function withTelegramStart(url: string) {
  if (!/^https:\/\/t\.me\//i.test(url)) return url;
  if (/[?&]start=/.test(url)) return url;
  return `${url}${url.includes("?") ? "&" : "?"}start=site`;
}

function cleanUrl(value?: string) {
  const url = String(value || "").trim();
  return /^https?:\/\//i.test(url) ? url : "";
}
