"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Bot,
  Check,
  Copy,
  Globe,
  KeyRound,
  Link as LinkIcon,
  MessageCircle,
  Radio,
  Save,
  Send,
  ShieldCheck,
  UserRound,
  Users,
} from "lucide-react";

type ProviderKey = "TELEGRAM" | "MAX";

interface ProviderInfo {
  key: ProviderKey;
  label: string;
  enabled: boolean;
  username: string | null;
  firstName: string | null;
  tokenSet: boolean;
}

interface BotEnvSettings {
  telegramAdminChatId: string;
  maxAdminChatId: string;
  publicTelegramUsername: string;
  publicMaxUsername: string;
  telegramWebhookSecretSet: boolean;
  maxWebhookSecretSet: boolean;
}

interface StaffUser {
  id: string;
  name: string;
  email: string;
  role: string;
  telegramId: string | null;
  maxId: string | null;
}

interface EditableStaffUser extends StaffUser {
  telegramIdValue: string;
  maxIdValue: string;
}

const providerCopy: Record<ProviderKey, { tokenEnv: string; secretEnv: string; adminEnv: string; status: string }> = {
  TELEGRAM: {
    tokenEnv: "TELEGRAM_BOT_TOKEN",
    secretEnv: "TELEGRAM_WEBHOOK_SECRET",
    adminEnv: "TELEGRAM_ADMIN_CHAT_ID",
    status: "основной канал",
  },
  MAX: {
    tokenEnv: "MAX_BOT_TOKEN",
    secretEnv: "MAX_WEBHOOK_SECRET",
    adminEnv: "MAX_ADMIN_CHAT_ID",
    status: "ограниченная поддержка",
  },
};

export function BotSettings({
  providers,
  defaultBaseUrl,
  initialSettings,
  users,
}: {
  providers: ProviderInfo[];
  defaultBaseUrl: string;
  initialSettings: BotEnvSettings;
  users: StaffUser[];
}) {
  const [baseUrl, setBaseUrl] = useState(defaultBaseUrl);
  const [settings, setSettings] = useState({
    telegramToken: "",
    telegramSecret: "",
    telegramAdminChatId: initialSettings.telegramAdminChatId,
    maxToken: "",
    maxSecret: "",
    maxAdminChatId: initialSettings.maxAdminChatId,
  });
  const [staff, setStaff] = useState<EditableStaffUser[]>(
    users.map((user) => ({
      ...user,
      telegramIdValue: user.telegramId || "",
      maxIdValue: user.maxId || "",
    })),
  );
  const [savingEnv, setSavingEnv] = useState(false);
  const [savingUsers, setSavingUsers] = useState(false);
  const [envResult, setEnvResult] = useState("");
  const [usersResult, setUsersResult] = useState("");
  const [setupResult, setSetupResult] = useState("");
  const [setupPending, setSetupPending] = useState<ProviderKey | null>(null);
  const [testProvider, setTestProvider] = useState<ProviderKey>("TELEGRAM");
  const [testChatId, setTestChatId] = useState("");
  const [testText, setTestText] = useState("Проверка связи с CRM. Если сообщение пришло, бот настроен.");
  const [testPending, setTestPending] = useState("");
  const [testResult, setTestResult] = useState("");

  const telegram = providers.find((provider) => provider.key === "TELEGRAM");
  const max = providers.find((provider) => provider.key === "MAX");
  const adminsWithChat = useMemo(
    () => staff.filter((user) => user.role === "ADMIN" && (user.telegramIdValue.trim() || user.maxIdValue.trim())),
    [staff],
  );

  async function saveEnvSettings() {
    setSavingEnv(true);
    setEnvResult("");
    const res = await fetch("/api/bot/settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        PUBLIC_BASE_URL: baseUrl,
        TELEGRAM_BOT_TOKEN: settings.telegramToken,
        TELEGRAM_WEBHOOK_SECRET: settings.telegramSecret,
        TELEGRAM_ADMIN_CHAT_ID: settings.telegramAdminChatId,
        MAX_BOT_TOKEN: settings.maxToken,
        MAX_WEBHOOK_SECRET: settings.maxSecret,
        MAX_ADMIN_CHAT_ID: settings.maxAdminChatId,
      }),
    });
    setSavingEnv(false);
    setEnvResult(res.ok ? "Настройки сохранены. Если меняли токен, перезапустите сервер." : "Не удалось сохранить настройки.");
  }

  async function saveUsers() {
    setSavingUsers(true);
    setUsersResult("");
    const res = await fetch("/api/bot/users", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        users: staff.map((user) => ({
          id: user.id,
          telegramId: user.telegramIdValue,
          maxId: user.maxIdValue,
        })),
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSavingUsers(false);
    setUsersResult(res.ok ? "Привязки сотрудников сохранены." : data.error || "Не удалось сохранить сотрудников.");
  }

  async function setupWebhook(provider: ProviderKey) {
    setSetupPending(provider);
    setSetupResult("");
    const res = await fetch("/api/bot/setup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ provider, baseUrl }),
    });
    const data = await res.json().catch(() => ({}));
    setSetupPending(null);
    setSetupResult(data.ok ? "Webhook зарегистрирован." : data.description || data.error || "Не удалось зарегистрировать webhook.");
  }

  async function sendTest(provider: ProviderKey, externalId: string, text = testText) {
    const cleanId = externalId.trim();
    if (!cleanId) return;
    const pendingKey = `${provider}:${cleanId}`;
    setTestPending(pendingKey);
    setTestResult("");
    const res = await fetch("/api/bot/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ provider, externalId: cleanId, text }),
    });
    const data = await res.json().catch(() => ({}));
    setTestPending("");
    setTestResult(res.ok ? "Тестовое сообщение отправлено." : data.error || "Не удалось отправить тест.");
  }

  const webhookUrl = (provider: ProviderKey) =>
    baseUrl ? `${baseUrl.replace(/\/+$/, "")}/api/messenger/${provider.toLowerCase()}/webhook` : "";

  return (
    <div className="space-y-5 max-w-6xl">
      <header className="space-y-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Бот для CRM</h1>
          <p className="text-sm text-muted-fg mt-1 max-w-3xl">
            Один бот обслуживает клиентов, мастеров и администраторов. Если chat id не привязан к сотруднику, человек
            видит клиентское меню. Если chat id найден у сотрудника, бот показывает рабочее меню. Администраторы
            дополнительно получают уведомления о новых заявках.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <StatusTile
            label="Telegram"
            value={telegram?.enabled ? "подключен" : telegram?.tokenSet ? "нужен перезапуск" : "токен не задан"}
            tone={telegram?.enabled ? "success" : "warning"}
          />
          <StatusTile
            label="Webhook"
            value={baseUrl ? "адрес указан, активируется отдельно" : "нужен публичный HTTPS-адрес"}
            tone={baseUrl ? "neutral" : "warning"}
          />
          <StatusTile
            label="Админы"
            value={adminsWithChat.length ? `${adminsWithChat.length} с chat id` : "chat id не привязаны"}
            tone={adminsWithChat.length ? "success" : "warning"}
          />
        </div>
      </header>

      <StepCard number="1" icon={<MessageCircle className="h-4 w-4" />} title="Канал бота">
        <div className="grid gap-3 md:grid-cols-2">
          <ProviderChannel provider={telegram} fallbackLabel="Telegram" primary />
          <ProviderChannel provider={max} fallbackLabel="Max" />
        </div>
        <PublicLinks
          telegramUsername={telegram?.username || null}
          telegramEnabled={!!telegram?.enabled}
          currentTelegramPublic={initialSettings.publicTelegramUsername}
          currentMaxPublic={initialSettings.publicMaxUsername}
        />
      </StepCard>

      <StepCard number="2" icon={<KeyRound className="h-4 w-4" />} title="Подключение">
        <div className="grid gap-4 lg:grid-cols-2">
          <ProviderSecrets
            title="Telegram"
            tokenSet={!!telegram?.tokenSet}
            secretSet={initialSettings.telegramWebhookSecretSet}
            tokenValue={settings.telegramToken}
            secretValue={settings.telegramSecret}
            tokenEnv={providerCopy.TELEGRAM.tokenEnv}
            secretEnv={providerCopy.TELEGRAM.secretEnv}
            onTokenChange={(telegramToken) => setSettings((current) => ({ ...current, telegramToken }))}
            onSecretChange={(telegramSecret) => setSettings((current) => ({ ...current, telegramSecret }))}
          />
          <ProviderSecrets
            title="Max"
            tokenSet={!!max?.tokenSet}
            secretSet={initialSettings.maxWebhookSecretSet}
            tokenValue={settings.maxToken}
            secretValue={settings.maxSecret}
            tokenEnv={providerCopy.MAX.tokenEnv}
            secretEnv={providerCopy.MAX.secretEnv}
            limited
            onTokenChange={(maxToken) => setSettings((current) => ({ ...current, maxToken }))}
            onSecretChange={(maxSecret) => setSettings((current) => ({ ...current, maxSecret }))}
          />
        </div>

        <div className="mt-4 rounded-xl border border-border bg-bg/40 p-4">
          <SettingsField label="Публичный HTTPS-адрес" hint="PUBLIC_BASE_URL">
            <div className="flex flex-col gap-2 md:flex-row">
              <input
                className="input h-12 text-base md:h-11"
                placeholder="https://example.ru или https://abcd.ngrok-free.app"
                value={baseUrl}
                onChange={(event) => setBaseUrl(event.target.value)}
              />
              <button
                type="button"
                className="btn-outline h-12 md:h-11"
                onClick={() => navigator.clipboard?.writeText(webhookUrl("TELEGRAM"))}
                disabled={!baseUrl}
              >
                <Copy className="h-4 w-4" /> URL webhook
              </button>
            </div>
          </SettingsField>

          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <ModeBox
              icon={<Globe className="h-4 w-4" />}
              title="Webhook"
              text="Для сервера и туннеля. Укажите публичный HTTPS-адрес и зарегистрируйте webhook."
              action={
                <button
                  type="button"
                  className="btn-primary h-11"
                  onClick={() => setupWebhook("TELEGRAM")}
                  disabled={!baseUrl || setupPending === "TELEGRAM" || !telegram?.enabled}
                >
                  {setupPending === "TELEGRAM" ? "Регистрация..." : "Зарегистрировать Telegram"}
                </button>
              }
            />
            <ModeBox
              icon={<Radio className="h-4 w-4" />}
              title="Polling"
              text="Для локальной работы без ngrok. Запустите в отдельном терминале команду npm run bot:poll."
              action={<code className="rounded-lg border border-border bg-muted px-3 py-2 text-xs">npm run bot:poll</code>}
            />
          </div>
          {setupResult && <p className="mt-3 text-sm text-muted-fg">{setupResult}</p>}

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            <button type="button" onClick={saveEnvSettings} disabled={savingEnv} className="btn-primary h-12 sm:h-11">
              <Save className="h-4 w-4" /> {savingEnv ? "Сохранение..." : "Сохранить подключение"}
            </button>
            {envResult && <p className="text-sm text-muted-fg">{envResult}</p>}
          </div>
        </div>
      </StepCard>

      <StepCard number="3" icon={<Users className="h-4 w-4" />} title="Роли и доступы">
        <p className="text-sm text-muted-fg mb-4">
          Роль берется из карточки сотрудника. Заполните Telegram chat id или Max chat id, чтобы бот понял, что это
          мастер или администратор. Отдельные токены для ролей не нужны.
        </p>
        <div className="space-y-3">
          {staff.map((user) => (
            <StaffRow
              key={user.id}
              user={user}
              pendingKey={testPending}
              onChange={(patch) =>
                setStaff((current) => current.map((item) => (item.id === user.id ? { ...item, ...patch } : item)))
              }
              onTest={sendTest}
            />
          ))}
          {!staff.length && <div className="rounded-xl border border-border bg-bg/40 p-4 text-sm text-muted-fg">Активных сотрудников нет.</div>}
        </div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
          <button type="button" onClick={saveUsers} disabled={savingUsers} className="btn-primary h-12 sm:h-11">
            <Save className="h-4 w-4" /> {savingUsers ? "Сохранение..." : "Сохранить сотрудников"}
          </button>
          {usersResult && <p className="text-sm text-muted-fg">{usersResult}</p>}
        </div>
      </StepCard>

      <StepCard number="4" icon={<ShieldCheck className="h-4 w-4" />} title="Уведомления админа">
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
            <div className="font-medium mb-2">Основной способ</div>
            <p className="text-sm text-muted-fg leading-relaxed">
              Заполните chat id у сотрудников с ролью ADMIN. Новые заявки с сайта и из бота будут приходить этим
              администраторам. Если один и тот же chat id указан и у пользователя, и в fallback-поле, сообщение не
              дублируется.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {adminsWithChat.length ? (
                adminsWithChat.map((admin) => <RolePill key={admin.id} role={`ADMIN: ${admin.name}`} />)
              ) : (
                <span className="text-xs text-warning">Пока нет ADMIN с chat id</span>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-bg/40 p-4 space-y-3">
            <div>
              <div className="font-medium">Дополнительные получатели</div>
              <p className="text-xs text-muted-fg mt-1">Для внешних chat id, которые не заведены как сотрудники.</p>
            </div>
            <SettingsField label="Telegram admin chat id" hint={providerCopy.TELEGRAM.adminEnv}>
              <input
                className="input h-12 text-base md:h-11"
                value={settings.telegramAdminChatId}
                onChange={(event) => setSettings((current) => ({ ...current, telegramAdminChatId: event.target.value }))}
                placeholder="Один или несколько через запятую"
              />
            </SettingsField>
            <SettingsField label="Max admin chat id" hint={providerCopy.MAX.adminEnv}>
              <input
                className="input h-12 text-base md:h-11"
                value={settings.maxAdminChatId}
                onChange={(event) => setSettings((current) => ({ ...current, maxAdminChatId: event.target.value }))}
                placeholder="Один или несколько через запятую"
              />
            </SettingsField>
          </div>
        </div>
      </StepCard>

      <StepCard number="5" icon={<Send className="h-4 w-4" />} title="Проверка">
        <div className="grid gap-3 lg:grid-cols-[160px_1fr]">
          <label className="block">
            <div className="text-xs font-medium text-muted-fg uppercase tracking-wider mb-1.5">Канал</div>
            <select className="input h-12 text-base md:h-11" value={testProvider} onChange={(event) => setTestProvider(event.target.value as ProviderKey)}>
              <option value="TELEGRAM">Telegram</option>
              <option value="MAX">Max</option>
            </select>
          </label>
          <SettingsField label="Chat id" hint="можно отправить сотруднику или любому известному chat id">
            <input
              className="input h-12 text-base md:h-11"
              value={testChatId}
              onChange={(event) => setTestChatId(event.target.value)}
              placeholder="Например 123456789"
            />
          </SettingsField>
        </div>
        <SettingsField label="Текст сообщения" hint="для проверки связи">
          <textarea
            className="input min-h-[88px] py-3 text-base"
            value={testText}
            onChange={(event) => setTestText(event.target.value)}
          />
        </SettingsField>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            type="button"
            className="btn-primary h-12 sm:h-11"
            onClick={() => sendTest(testProvider, testChatId)}
            disabled={!testChatId.trim() || testPending === `${testProvider}:${testChatId.trim()}`}
          >
            <Send className="h-4 w-4" /> Отправить тест
          </button>
          {testResult && <p className="text-sm text-muted-fg">{testResult}</p>}
        </div>
      </StepCard>
    </div>
  );
}

function PublicLinks({
  telegramUsername,
  telegramEnabled,
  currentTelegramPublic,
  currentMaxPublic,
}: {
  telegramUsername: string | null;
  telegramEnabled: boolean;
  currentTelegramPublic: string;
  currentMaxPublic: string;
}) {
  const [tg, setTg] = useState(currentTelegramPublic);
  const [mx, setMx] = useState(currentMaxPublic);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState("");

  const suggested = telegramUsername && !tg && telegramUsername !== currentTelegramPublic;

  async function save(overrideTg?: string) {
    setPending(true);
    setResult("");
    const finalTg = (overrideTg ?? tg).trim().replace(/^@/, "");
    const res = await fetch("/api/bot/settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        NEXT_PUBLIC_TELEGRAM_BOT_USERNAME: finalTg,
        NEXT_PUBLIC_MAX_BOT_USERNAME: mx.trim().replace(/^@/, ""),
      }),
    });
    setPending(false);
    if (res.ok) {
      setResult("Сохранено. Перезапустите сервер, чтобы кнопки появились на сайте.");
      if (overrideTg !== undefined) setTg(finalTg);
    } else {
      setResult("Не удалось сохранить.");
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-border bg-bg/40 p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
        <div>
          <div className="text-sm font-medium">Публичные кнопки на сайте</div>
          <p className="text-xs text-muted-fg mt-1 leading-relaxed">
            Появятся в шапке, мобильной панели, hero-секции и футере. Клиент пишет боту → у него сразу клиентское меню.
          </p>
        </div>
        {suggested && telegramEnabled && (
          <button
            type="button"
            onClick={() => save(telegramUsername!)}
            disabled={pending}
            className="btn-primary h-9 text-xs"
          >
            {pending ? "..." : `Использовать @${telegramUsername}`}
          </button>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <SettingsField label="Telegram username" hint="NEXT_PUBLIC_TELEGRAM_BOT_USERNAME">
          <div className="flex gap-2">
            <span className="inline-flex items-center px-3 rounded-lg border border-border bg-card/40 text-muted-fg text-sm">@</span>
            <input
              className="input h-11 flex-1"
              value={tg}
              onChange={(e) => setTg(e.target.value)}
              placeholder="ваш_бот"
              autoComplete="off"
            />
          </div>
        </SettingsField>
        <SettingsField label="Max username" hint="NEXT_PUBLIC_MAX_BOT_USERNAME — когда появится API">
          <div className="flex gap-2">
            <span className="inline-flex items-center px-3 rounded-lg border border-border bg-card/40 text-muted-fg text-sm">@</span>
            <input
              className="input h-11 flex-1"
              value={mx}
              onChange={(e) => setMx(e.target.value)}
              placeholder="ваш_бот"
              autoComplete="off"
            />
          </div>
        </SettingsField>
      </div>

      <div className="mt-3 flex items-center gap-2 flex-wrap">
        <button type="button" onClick={() => save()} disabled={pending} className="btn-outline h-10">
          <Save className="h-4 w-4" /> {pending ? "Сохранение..." : "Сохранить кнопки"}
        </button>
        {result && <span className="text-xs text-muted-fg">{result}</span>}
      </div>
    </div>
  );
}

function StatusTile({ label, value, tone }: { label: string; value: string; tone: "success" | "warning" | "neutral" }) {
  const toneClass =
    tone === "success"
      ? "border-success/30 bg-success/10 text-success"
      : tone === "warning"
        ? "border-warning/30 bg-warning/10 text-warning"
        : "border-border bg-card/40 text-muted-fg";

  return (
    <div className={`rounded-xl border px-4 py-3 ${toneClass}`}>
      <div className="text-xs uppercase tracking-wider opacity-80">{label}</div>
      <div className="mt-1 text-sm font-medium text-fg">{value}</div>
    </div>
  );
}

function StepCard({ number, icon, title, children }: { number: string; icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="card p-4 md:p-5">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/15 text-primary">
          {number}
        </div>
        <div className="flex items-center gap-2 font-semibold">
          {icon}
          <h2>{title}</h2>
        </div>
      </div>
      {children}
    </section>
  );
}

function ProviderChannel({
  provider,
  fallbackLabel,
  primary,
}: {
  provider?: ProviderInfo;
  fallbackLabel: string;
  primary?: boolean;
}) {
  const enabled = !!provider?.enabled;
  return (
    <div className={`rounded-xl border p-4 ${primary ? "border-primary/30 bg-primary/5" : "border-border bg-bg/40"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-card/60">
            <Bot className="h-5 w-5 text-primary" />
          </div>
          <div>
            <div className="font-medium">{provider?.label || fallbackLabel}</div>
            <div className="mt-1 text-sm text-muted-fg">
              {primary ? "Рабочий канал для клиентов, мастеров и админов." : "Виден в настройках, но пока используется ограниченно."}
            </div>
            {provider?.username && <div className="mt-2 text-sm text-primary">@{provider.username}</div>}
            {provider?.firstName && !provider.username && <div className="mt-2 text-sm text-muted-fg">{provider.firstName}</div>}
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2 py-1 text-xs ${
            enabled ? "border-success/30 bg-success/10 text-success" : "border-warning/30 bg-warning/10 text-warning"
          }`}
        >
          {enabled ? "подключен" : primary ? "нужен токен" : "скоро"}
        </span>
      </div>
    </div>
  );
}

function ProviderSecrets({
  title,
  tokenSet,
  secretSet,
  tokenValue,
  secretValue,
  tokenEnv,
  secretEnv,
  limited,
  onTokenChange,
  onSecretChange,
}: {
  title: string;
  tokenSet: boolean;
  secretSet: boolean;
  tokenValue: string;
  secretValue: string;
  tokenEnv: string;
  secretEnv: string;
  limited?: boolean;
  onTokenChange: (value: string) => void;
  onSecretChange: (value: string) => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-bg/40 p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="font-medium">{title}</div>
        <div className="flex flex-wrap justify-end gap-2">
          <StateBadge ok={tokenSet} okText="токен задан" badText="нет токена" />
          <StateBadge ok={secretSet} okText="secret задан" badText="secret пустой" neutralBad />
          {limited && <span className="rounded-full border border-warning/30 bg-warning/10 px-2 py-1 text-xs text-warning">ограничено</span>}
        </div>
      </div>
      <SettingsField label="Токен бота" hint={tokenEnv}>
        <input
          type="password"
          className="input h-12 text-base md:h-11"
          value={tokenValue}
          onChange={(event) => onTokenChange(event.target.value)}
          placeholder={tokenSet ? "Оставьте пустым, чтобы не менять" : "Вставьте токен"}
          autoComplete="off"
        />
      </SettingsField>
      <SettingsField label="Webhook secret" hint={secretEnv}>
        <input
          type="password"
          className="input h-12 text-base md:h-11"
          value={secretValue}
          onChange={(event) => onSecretChange(event.target.value)}
          placeholder={secretSet ? "Оставьте пустым, чтобы не менять" : "Любая длинная строка"}
          autoComplete="off"
        />
      </SettingsField>
    </div>
  );
}

function StaffRow({
  user,
  pendingKey,
  onChange,
  onTest,
}: {
  user: EditableStaffUser;
  pendingKey: string;
  onChange: (patch: Partial<EditableStaffUser>) => void;
  onTest: (provider: ProviderKey, externalId: string, text?: string) => void;
}) {
  const [pairing, setPairing] = useState<{ link: string | null; token: string; instruction: string; expiresAt: string } | null>(null);
  const [pairPending, setPairPending] = useState(false);

  async function generatePair(provider: ProviderKey) {
    setPairPending(true);
    const res = await fetch("/api/bot/pair/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: user.id, provider }),
    });
    const data = await res.json();
    setPairPending(false);
    if (res.ok) setPairing(data);
  }

  return (
    <div className="rounded-xl border border-border bg-bg/40 p-3 md:p-4">
      <div className="grid gap-3 lg:grid-cols-[minmax(180px,1fr)_minmax(190px,240px)_minmax(190px,240px)] lg:items-end">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-card/60">
              <UserRound className="h-4 w-4 text-muted-fg" />
            </div>
            <div className="min-w-0">
              <div className="truncate font-medium">{user.name}</div>
              <div className="truncate text-xs text-muted-fg">{user.email}</div>
            </div>
          </div>
          <div className="mt-2">
            <RolePill role={roleLabel(user.role)} />
          </div>
        </div>

        <ChatIdField
          label="Telegram chat id"
          value={user.telegramIdValue}
          onChange={(telegramIdValue) => onChange({ telegramIdValue })}
          onTest={() => onTest("TELEGRAM", user.telegramIdValue, "Проверка Telegram-привязки сотрудника в CRM.")}
          onPair={() => generatePair("TELEGRAM")}
          pairPending={pairPending}
          pending={pendingKey === `TELEGRAM:${user.telegramIdValue.trim()}`}
        />

        <ChatIdField
          label="Max chat id"
          value={user.maxIdValue}
          onChange={(maxIdValue) => onChange({ maxIdValue })}
          onTest={() => onTest("MAX", user.maxIdValue, "Проверка Max-привязки сотрудника в CRM.")}
          pending={pendingKey === `MAX:${user.maxIdValue.trim()}`}
        />
      </div>

      {pairing && (
        <div className="mt-3 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
          <div className="font-medium mb-1.5 flex items-center gap-2">
            <LinkIcon className="h-4 w-4 text-primary" />
            Привязка через бот
          </div>
          {pairing.link ? (
            <>
              <p className="text-muted-fg text-xs mb-2 leading-relaxed">
                Перешлите сотруднику ссылку. Один клик — бот привяжет его автоматически. Код действителен 15 минут.
              </p>
              <div className="flex items-center gap-2">
                <a
                  href={pairing.link}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-primary h-10 flex-1 truncate text-xs"
                >
                  Открыть в Telegram
                </a>
                <button
                  type="button"
                  className="btn-outline h-10 px-3"
                  onClick={() => navigator.clipboard?.writeText(pairing.link!)}
                  title="Копировать ссылку"
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-2 font-mono text-[11px] text-muted-fg break-all">{pairing.link}</div>
            </>
          ) : (
            <>
              <p className="text-muted-fg text-xs mb-2 leading-relaxed">
                Не удалось получить username бота. Сотрудник может ввести команду вручную:
              </p>
              <code className="block rounded-md bg-muted px-3 py-2 text-xs font-mono">/start PAIR-{pairing.token}</code>
            </>
          )}
          <button
            type="button"
            onClick={() => setPairing(null)}
            className="btn-ghost h-7 px-2 text-xs mt-2"
          >
            Скрыть
          </button>
        </div>
      )}
    </div>
  );
}

function ChatIdField({
  label,
  value,
  onChange,
  onTest,
  onPair,
  pending,
  pairPending,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onTest: () => void;
  onPair?: () => void;
  pending: boolean;
  pairPending?: boolean;
}) {
  return (
    <label className="block">
      <div className="text-xs font-medium text-muted-fg uppercase tracking-wider mb-1.5 flex items-center justify-between">
        <span>{label}</span>
        {onPair && (
          <button
            type="button"
            onClick={onPair}
            disabled={pairPending}
            className="text-[10px] text-primary hover:underline font-normal normal-case tracking-normal"
          >
            {pairPending ? "..." : "🔗 Привязать через бот"}
          </button>
        )}
      </div>
      <div className="flex gap-2">
        <input
          className="input h-12 min-w-0 flex-1 text-base md:h-11"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="chat id"
          inputMode="numeric"
        />
        <button type="button" className="btn-outline h-12 px-3 md:h-11" onClick={onTest} disabled={!value.trim() || pending}>
          <Send className="h-4 w-4" />
          <span className="hidden sm:inline">{pending ? "..." : "Тест"}</span>
        </button>
      </div>
    </label>
  );
}

function SettingsField({ label, hint, children }: { label: string; hint: string; children: ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1.5 flex flex-wrap items-baseline gap-2">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-fg">{label}</span>
        <span className="text-[11px] text-slate-500">{hint}</span>
      </div>
      {children}
    </label>
  );
}

function ModeBox({ icon, title, text, action }: { icon: ReactNode; title: string; text: string; action: ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card/30 p-4">
      <div className="flex items-center gap-2 font-medium">
        {icon}
        {title}
      </div>
      <p className="mt-2 min-h-[40px] text-sm text-muted-fg">{text}</p>
      <div className="mt-3">{action}</div>
    </div>
  );
}

function StateBadge({
  ok,
  okText,
  badText,
  neutralBad,
}: {
  ok: boolean;
  okText: string;
  badText: string;
  neutralBad?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs ${
        ok
          ? "border-success/30 bg-success/10 text-success"
          : neutralBad
            ? "border-border bg-muted text-muted-fg"
            : "border-warning/30 bg-warning/10 text-warning"
      }`}
    >
      {ok ? <Check className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
      {ok ? okText : badText}
    </span>
  );
}

function RolePill({ role }: { role: string }) {
  return <span className="inline-flex rounded-full border border-border bg-card/50 px-2 py-1 text-xs text-muted-fg">{role}</span>;
}

function roleLabel(role: string) {
  if (role === "ADMIN") return "Администратор";
  if (role === "MASTER") return "Мастер";
  if (role === "MANAGER") return "Менеджер";
  return role;
}
