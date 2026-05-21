"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Search, Sparkles, Check, Plus, X, Cpu, Info, Trash2 } from "lucide-react";
import { formatRub } from "@/lib/utils";
import Link from "next/link";
import { Reveal } from "./Reveal";

type Service = { id: string; name: string; kind: string; slug: string };
type Cartridge = {
  id: string;
  brand: string;
  model: string;
  type: string;
  isPopular: boolean;
  isOriginal: boolean;
  hasChip: boolean;
  chipPrice: number | null; // копейки
  price: number | null;     // копейки за заправку
};

interface CartItem {
  // Уникальный ключ строки в корзине (несколько строк с одним картриджем разрешены)
  key: string;
  cartridge: Cartridge;
  serviceId: string;
  quantity: number;
  withChip: boolean;
}

const DEFAULT_CHIP_PRICE = 15000; // копейки = 150 ₽

export function Calculator({ services, cartridges }: { services: Service[]; cartridges: Cartridge[] }) {
  const [activeServiceId, setActiveServiceId] = useState(
    services.find((s) => s.slug === "zapravka")?.id || services[0]?.id || ""
  );
  const [query, setQuery] = useState("");
  const [brand, setBrand] = useState<string>("all");
  const [sort, setSort] = useState<"popular" | "brand" | "price">("popular");
  const [cart, setCart] = useState<CartItem[]>([]);

  const brands = useMemo(() => Array.from(new Set(cartridges.map((c) => c.brand))).sort(), [cartridges]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = cartridges.filter((c) => {
      if (brand !== "all" && c.brand !== brand) return false;
      if (!q) return true;
      return c.model.toLowerCase().includes(q) || c.brand.toLowerCase().includes(q);
    });
    list.sort((a, b) => {
      if (sort === "popular") return Number(b.isPopular) - Number(a.isPopular) || a.model.localeCompare(b.model);
      if (sort === "brand") return a.brand.localeCompare(b.brand) || a.model.localeCompare(b.model);
      return (a.price ?? Infinity) - (b.price ?? Infinity);
    });
    return list.slice(0, 30);
  }, [cartridges, query, brand, sort]);

  function addToCart(c: Cartridge) {
    setCart((arr) => [
      ...arr,
      {
        key: Math.random().toString(36).slice(2),
        cartridge: c,
        serviceId: activeServiceId,
        quantity: 1,
        withChip: c.hasChip, // если есть чип — по умолчанию включаем замену
      },
    ]);
  }

  function removeItem(key: string) {
    setCart((arr) => arr.filter((i) => i.key !== key));
  }

  function updateItem(key: string, patch: Partial<CartItem>) {
    setCart((arr) => arr.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  }

  // Расчёт цены строки
  function itemTotal(it: CartItem) {
    const refill = it.cartridge.price ?? 0;
    const chip = it.withChip ? (it.cartridge.chipPrice ?? DEFAULT_CHIP_PRICE) : 0;
    return (refill + chip) * it.quantity;
  }

  const subtotal = cart.reduce((s, it) => s + itemTotal(it), 0);
  const chipsTotal = cart.reduce(
    (s, it) => s + (it.withChip ? (it.cartridge.chipPrice ?? DEFAULT_CHIP_PRICE) * it.quantity : 0),
    0,
  );

  return (
    <section id="calculator" className="container py-20 lg:py-28">
      <Reveal>
        <div className="flex items-end justify-between gap-6 flex-wrap mb-10">
          <div>
            <div className="chip mb-4"><span className="font-mono text-primary">04</span> Калькулятор</div>
            <h2 className="heading-display text-4xl md:text-5xl lg:text-6xl">
              Соберите расчёт <span className="text-gradient">за минуту</span>
            </h2>
          </div>
          <p className="text-muted-fg max-w-md">
            Добавьте все картриджи, которые нужно обслужить — увидите общую сумму. Точная сумма у мастера на месте.
          </p>
        </div>
      </Reveal>

      <Reveal>
        <div className="card overflow-hidden relative">
          <div className="grid lg:grid-cols-[1fr,420px]">
            <div className="p-6 lg:p-8 space-y-7">
              <Step n={1} title="Услуга">
                <div className="grid grid-cols-2 gap-2">
                  {services.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setActiveServiceId(s.id)}
                      className={`group relative rounded-xl border px-4 py-3 text-sm text-left transition-all ${
                        activeServiceId === s.id
                          ? "border-primary bg-primary/10 text-fg"
                          : "border-border bg-card/40 hover:bg-card"
                      }`}
                    >
                      {activeServiceId === s.id && <Check className="absolute right-3 top-3 h-3.5 w-3.5 text-primary" />}
                      {s.name}
                    </button>
                  ))}
                </div>
              </Step>

              <Step n={2} title="Картриджи">
                <div className="flex flex-wrap gap-2 mb-3">
                  <div className="relative flex-1 min-w-[220px]">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-fg" />
                    <input
                      className="input pl-10"
                      placeholder="Модель картриджа или принтера"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </div>
                  <select className="input w-auto" value={brand} onChange={(e) => setBrand(e.target.value)}>
                    <option value="all">Все бренды</option>
                    {brands.map((b) => <option key={b} value={b}>{b}</option>)}
                  </select>
                  <select className="input w-auto" value={sort} onChange={(e) => setSort(e.target.value as any)}>
                    <option value="popular">Популярные</option>
                    <option value="brand">По бренду</option>
                    <option value="price">По цене</option>
                  </select>
                </div>

                <div className="max-h-80 overflow-auto rounded-xl border border-border divide-y divide-border bg-bg/40">
                  {filtered.length === 0 && (
                    <div className="p-6 text-center text-sm text-muted-fg">Не нашли — впишите модель в комментарий к заявке.</div>
                  )}
                  {filtered.map((c) => {
                    const inCart = cart.some((it) => it.cartridge.id === c.id);
                    return (
                      <div key={c.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-muted/30 transition">
                        <div className="min-w-0">
                          <div className="font-medium flex items-center gap-2 truncate">
                            <span className="text-muted-fg font-mono text-xs">{c.brand}</span>
                            {c.model}
                          </div>
                          <div className="text-xs text-muted-fg mt-1 flex items-center gap-1.5 flex-wrap">
                            {c.isPopular && <Badge tone="primary">Популярный</Badge>}
                            {c.isOriginal ? <Badge tone="warning">Оригинал</Badge> : <Badge tone="muted">Совместимый</Badge>}
                            {c.hasChip && (
                              <Badge tone="chip">
                                <Cpu className="h-2.5 w-2.5 mr-0.5 inline" />С чипом
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          {c.price != null && <div className="text-sm tabular-nums text-fg">{formatRub(c.price)}</div>}
                          <button
                            type="button"
                            onClick={() => addToCart(c)}
                            className={`btn-outline h-9 px-3 ${inCart ? "border-primary/40 text-primary" : ""}`}
                            title="Добавить в расчёт"
                          >
                            <Plus className="h-4 w-4" />
                            <span className="hidden sm:inline">{inCart ? "Ещё" : "Добавить"}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Step>

              <ChipInfo />
            </div>

            <CartAside
              cart={cart}
              services={services}
              subtotal={subtotal}
              chipsTotal={chipsTotal}
              updateItem={updateItem}
              removeItem={removeItem}
              itemTotal={itemTotal}
            />
          </div>
        </div>
      </Reveal>
    </section>
  );
}

// ────────────────────────────────────────────────────────────────────────────

function CartAside({
  cart, services, subtotal, chipsTotal, updateItem, removeItem, itemTotal,
}: {
  cart: CartItem[];
  services: Service[];
  subtotal: number;
  chipsTotal: number;
  updateItem: (key: string, patch: Partial<CartItem>) => void;
  removeItem: (key: string) => void;
  itemTotal: (it: CartItem) => number;
}) {
  return (
    <aside className="relative bg-gradient-to-br from-card-2 to-card border-l border-border p-6 lg:p-8 flex flex-col">
      <div className="absolute -top-px -left-px -right-px h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
      <div className="chip"><Sparkles className="h-3 w-3 text-primary" /> Ваш расчёт</div>

      {cart.length === 0 && (
        <div className="mt-6 flex-1 flex flex-col items-center justify-center text-center py-12">
          <div className="h-12 w-12 rounded-2xl bg-muted/50 flex items-center justify-center text-muted-fg mb-3">
            <Plus className="h-5 w-5" />
          </div>
          <div className="text-sm font-medium">Корзина пуста</div>
          <div className="mt-1.5 text-xs text-muted-fg max-w-[240px] leading-relaxed">
            Добавьте картриджи из списка слева — увидите итоговую сумму
          </div>
        </div>
      )}

      {cart.length > 0 && (
        <div className="mt-5 space-y-3 max-h-[420px] overflow-y-auto -mx-2 px-2">
          {cart.map((it) => {
            const service = services.find((s) => s.id === it.serviceId);
            const chipPrice = it.cartridge.chipPrice ?? DEFAULT_CHIP_PRICE;
            return (
              <div key={it.key} className="rounded-xl border border-border bg-bg/40 p-3 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">
                      <span className="text-muted-fg font-mono text-xs">{it.cartridge.brand}</span> {it.cartridge.model}
                    </div>
                    <div className="text-[10px] text-muted-fg mt-0.5">{service?.name}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(it.key)}
                    className="text-muted-fg hover:text-danger transition shrink-0 p-1 -mr-1"
                    title="Убрать из расчёта"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <div className="inline-flex items-center rounded-lg border border-border bg-card/40 h-8">
                    <button onClick={() => updateItem(it.key, { quantity: Math.max(1, it.quantity - 1) })} className="px-2.5 hover:bg-muted transition rounded-l-lg text-sm">−</button>
                    <span className="w-8 text-center text-xs tabular-nums">{it.quantity}</span>
                    <button onClick={() => updateItem(it.key, { quantity: it.quantity + 1 })} className="px-2.5 hover:bg-muted transition rounded-r-lg text-sm">+</button>
                  </div>
                  <div className="text-sm tabular-nums font-medium">{formatRub(itemTotal(it))}</div>
                </div>

                {it.cartridge.hasChip && (
                  <label className="flex items-center justify-between gap-2 rounded-lg border border-warning/30 bg-warning/[0.06] px-2.5 py-1.5 cursor-pointer">
                    <span className="flex items-center gap-1.5 text-xs">
                      <input
                        type="checkbox"
                        checked={it.withChip}
                        onChange={(e) => updateItem(it.key, { withChip: e.target.checked })}
                        className="accent-warning"
                      />
                      <Cpu className="h-3 w-3 text-warning" />
                      <span>Замена чипа</span>
                    </span>
                    <span className="text-xs font-mono text-warning tabular-nums">+{formatRub(chipPrice)}</span>
                  </label>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-6 pt-5 border-t border-border space-y-2">
        {chipsTotal > 0 && (
          <div className="flex items-center justify-between text-xs text-muted-fg">
            <span>в т.ч. замена чипов</span>
            <span className="tabular-nums">{formatRub(chipsTotal)}</span>
          </div>
        )}
        <div className="flex items-baseline justify-between">
          <div className="text-xs uppercase tracking-wider text-muted-fg">Итого ориентировочно</div>
        </div>
        <div className="text-4xl font-semibold tabular-nums tracking-tight">{formatRub(subtotal)}</div>
      </div>

      <Link
        href="#request"
        className={`btn-primary btn-glow mt-5 py-3 ${cart.length === 0 ? "opacity-50 pointer-events-none" : ""}`}
      >
        Оставить заявку
      </Link>

      <div className="mt-4 rounded-lg border border-border bg-bg/40 p-3 text-xs text-muted-fg leading-relaxed">
        <span className="text-fg font-medium">Подмена быстрее</span> — можем привезти уже заправленный, а ваш забрать в сервис. Та же цена, офис продолжает печатать через 5 минут.
      </div>
    </aside>
  );
}

// ────────────────────────────────────────────────────────────────────────────

function ChipInfo() {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-border bg-card/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left text-sm"
      >
        <span className="flex items-center gap-2">
          <Cpu className="h-4 w-4 text-warning" />
          <span className="font-medium">Что такое замена чипа?</span>
        </span>
        <Info className="h-4 w-4 text-muted-fg" />
      </button>
      {open && (
        <div className="px-4 pb-4 text-xs text-muted-fg leading-relaxed space-y-2">
          <p>
            На большинстве современных лазерных картриджей <span className="text-fg">HP, Canon, Samsung, Xerox, Kyocera</span> стоит чип, который считает напечатанные страницы. После того как чип «увидел» 100% — принтер блокирует печать, даже если в картридже свежий тонер.
          </p>
          <p>
            При заправке мы меняем чип на новый — это копеечная деталь, но без неё картридж не оживить. У старых HP (Q-серия) и Canon (719, 703) чипа нет — за них доплата не нужна.
          </p>
          <p>
            <span className="text-fg">Стоимость замены чипа</span> — обычно 100–300 ₽, она автоматически добавляется в расчёт для моделей с чипом. Снять галочку можно, но без чипа картридж скорее всего не запустится.
          </p>
        </div>
      )}
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <div className="h-7 w-7 rounded-lg bg-primary/15 border border-primary/30 text-primary text-xs font-mono flex items-center justify-center">{n}</div>
        <div className="text-sm font-medium text-fg/80">{title}</div>
      </div>
      {children}
    </div>
  );
}

function Badge({ children, tone = "primary" }: { children: React.ReactNode; tone?: "primary" | "warning" | "muted" | "chip" }) {
  const cls = {
    primary: "bg-primary/15 text-primary border-primary/20",
    warning: "bg-warning/15 text-warning border-warning/20",
    muted: "bg-muted text-muted-fg border-border",
    chip: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  }[tone];
  return <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium ${cls}`}>{children}</span>;
}
