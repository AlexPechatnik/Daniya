import { BotSettings } from "@/components/crm/BotSettings";
import { getAdapter } from "@/lib/messengers";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function BotSettingsPage() {
  const telegram = getAdapter("TELEGRAM");
  const max = getAdapter("MAX");

  // getMe() — сетевой запрос к Telegram. Если сеть/VPN недоступны или таймаут —
  // не должны валить всю страницу настроек.
  let telegramInfo: Awaited<ReturnType<NonNullable<typeof telegram>["getMe"]>> | null = null;
  if (telegram?.enabled && telegram.getMe) {
    try {
      telegramInfo = await telegram.getMe();
    } catch (e) {
      console.error("[bot settings] telegram.getMe failed:", e);
    }
  }
  const users = await prisma.user.findMany({
    where: { active: true },
    orderBy: [{ role: "asc" }, { name: "asc" }],
    select: { id: true, name: true, email: true, role: true, telegramId: true, maxId: true },
  });

  return (
    <BotSettings
      providers={[
        {
          key: "TELEGRAM",
          label: "Telegram",
          enabled: telegram?.enabled || false,
          username: telegramInfo?.username || null,
          firstName: telegramInfo?.firstName || null,
          tokenSet: !!process.env.TELEGRAM_BOT_TOKEN,
        },
        {
          key: "MAX",
          label: "Max (VK)",
          enabled: max?.enabled || false,
          username: null,
          firstName: null,
          tokenSet: !!process.env.MAX_BOT_TOKEN,
        },
      ]}
      defaultBaseUrl={process.env.PUBLIC_BASE_URL || ""}
      initialSettings={{
        telegramAdminChatId: process.env.TELEGRAM_ADMIN_CHAT_ID || "",
        maxAdminChatId: process.env.MAX_ADMIN_CHAT_ID || "",
        publicTelegramUsername: (process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "").replace(/^@/, ""),
        publicMaxUsername: (process.env.NEXT_PUBLIC_MAX_BOT_USERNAME || "").replace(/^@/, ""),
        telegramWebhookSecretSet: !!process.env.TELEGRAM_WEBHOOK_SECRET,
        maxWebhookSecretSet: !!process.env.MAX_WEBHOOK_SECRET,
      }}
      users={users}
    />
  );
}
