"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, Loader2, Pencil, Plus, Search, Trash2, X } from "lucide-react";

export type CrmPriceRow = {
  id: string;
  serviceId: string;
  serviceSlug: string;
  serviceName: string;
  amount: number; // ₽
  note: string | null;
  cartridge: { brand: string; model: string; hasChip: boolean; pageYield: number | null } | null;
};

type Service = { id: string; slug: string; name: string };
const PAGE_SIZE = 40;

/**
 * Inline-редактор прайса для админа CRM.
 *   • Двойной клик / иконка карандаша → правка цены и заметки.
 *   • «+ Добавить» — модалка с полями service / brand / model / amount.
 *   • Поиск, сортировка по бренду/модели/цене, фильтр по услуге.
 *   • Сетевой статус: spinner → ✓, фокус не теряется.
 */
export function PriceTable({ initialRows, services }: { initialRows: CrmPriceRow[]; services: Service[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [query, setQuery] = useState("");
  const [serviceSlug, setServiceSlug] = useState<string>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ amount: string; note: string }>({ amount: "", note: "" });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter((r) => serviceSlug === "all" || r.serviceSlug === serviceSlug)
      .filter((r) => {
        if (!q) return true;
        const hay = [
          r.cartridge?.brand,
          r.cartridge?.model,
          r.note,
          r.serviceName,
        ].filter(Boolean).join(" ").toLowerCase();
        return hay.includes(q);
      });
  }, [rows, query, serviceSlug]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function startEdit(row: CrmPriceRow) {
    setEditingId(row.id);
    setDraft({ amount: String(row.amount), note: row.note || "" });
  }

  async function saveEdit(row: CrmPriceRow) {
    const amount = Number(draft.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      setEditingId(null);
      return;
    }
    setBusyId(row.id);
    const res = await fetch(`/api/price/${row.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ amount, note: draft.note }),
    });
    if (res.ok) {
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, amount, note: draft.note || null } : r)));
      setEditingId(null);
    }
    setBusyId(null);
  }

  async function remove(row: CrmPriceRow) {
    if (!confirm(`Удалить «${row.cartridge ? `${row.cartridge.brand} ${row.cartridge.model}` : row.serviceName}» из прайса?`)) return;
    setBusyId(row.id);
    const res = await fetch(`/api/price/${row.id}`, { method: "DELETE" });
    if (res.ok) {
      setRows((prev) => prev.filter((r) => r.id !== row.id));
    }
    setBusyId(null);
  }

  return (
    <div className="space-y-4">
      {/* Тулбар */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-fg" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Поиск по бренду, модели, услуге…"
            className="input h-10 w-full pl-10"
          />
        </div>
        <select
          value={serviceSlug}
          onChange={(e) => {
            setServiceSlug(e.target.value);
            setPage(1);
          }}
          className="input h-10 w-44"
        >
          <option value="all">Все услуги</option>
          {services.map((s) => (
            <option key={s.id} value={s.slug}>{s.name}</option>
          ))}
        </select>
        <button type="button" onClick={() => setShowAdd(true)} className="btn-primary h-10 px-4">
          <Plus className="h-4 w-4" /> Добавить
        </button>
      </div>

      {/* Таблица */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="grid grid-cols-[180px,1fr,90px,140px,140px,80px] gap-3 border-b border-border bg-bg-2/70 px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-muted-fg">
          <span>Услуга</span>
          <span>Картридж / описание</span>
          <span className="text-center">Чип</span>
          <span className="text-right">Ресурс</span>
          <span className="text-right">Цена, ₽</span>
          <span />
        </div>
        <ul className="divide-y divide-border">
          {filtered.length === 0 && (
            <li className="px-4 py-10 text-center text-sm text-muted-fg">Ничего не найдено.</li>
          )}
          {paged.map((row) => {
            const editing = editingId === row.id;
            const busy = busyId === row.id;
            return (
              <li key={row.id} className="grid grid-cols-[180px,1fr,90px,140px,140px,80px] items-center gap-3 px-4 py-2.5">
                <div className="text-sm text-muted-fg">{row.serviceName}</div>

                <div className="min-w-0">
                  {row.cartridge ? (
                    <>
                      <div className="truncate font-medium">{row.cartridge.brand} {row.cartridge.model}</div>
                      {editing ? (
                        <input
                          value={draft.note}
                          onChange={(e) => setDraft({ ...draft, note: e.target.value })}
                          placeholder="Заметка (например, акция/комплект)"
                          className="input mt-1 h-8 w-full text-xs"
                        />
                      ) : (
                        row.note && <div className="truncate text-xs text-muted-fg">{row.note}</div>
                      )}
                    </>
                  ) : (
                    <div className="text-sm text-muted-fg italic">Базовая цена услуги</div>
                  )}
                </div>

                <div className="text-center text-xs">
                  {row.cartridge?.hasChip ? <span className="text-amber-600">⚡ чип</span> : <span className="text-muted-fg/60">—</span>}
                </div>

                <div className="text-right text-xs tabular-nums text-muted-fg">
                  {row.cartridge?.pageYield ? `${row.cartridge.pageYield.toLocaleString("ru-RU")} стр.` : "—"}
                </div>

                <div className="text-right text-sm font-semibold tabular-nums">
                  {editing ? (
                    <input
                      autoFocus
                      type="number"
                      value={draft.amount}
                      onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEdit(row);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      className="input h-8 w-24 text-right font-semibold tabular-nums"
                    />
                  ) : (
                    <button onClick={() => startEdit(row)} className="hover:text-primary">
                      {row.amount.toLocaleString("ru-RU")} ₽
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-end gap-1">
                  {editing ? (
                    <>
                      <button
                        onClick={() => saveEdit(row)}
                        className="rounded-md p-1.5 text-emerald-600 hover:bg-emerald-500/10"
                        title="Сохранить"
                        disabled={busy}
                      >
                        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="rounded-md p-1.5 text-muted-fg hover:bg-muted/40"
                        title="Отмена"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => startEdit(row)}
                        className="rounded-md p-1.5 text-muted-fg hover:bg-muted/40 hover:text-fg"
                        title="Редактировать"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => remove(row)}
                        className="rounded-md p-1.5 text-muted-fg hover:bg-red-500/10 hover:text-red-500"
                        title="Удалить"
                        disabled={busy}
                      >
                        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      </button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="text-xs text-muted-fg">
        Показано {filtered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1}–
        {Math.min(currentPage * PAGE_SIZE, filtered.length)} из {filtered.length} найденных, всего {rows.length}.
        Кликните на цену — она станет редактируемой.
      </div>

      {pageCount > 1 && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-3 py-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="inline-flex h-9 items-center gap-2 rounded-full border border-border px-3 text-sm disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" /> Назад
          </button>
          <div className="text-sm text-muted-fg">
            Страница <span className="font-medium text-fg">{currentPage}</span> из {pageCount}
          </div>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            disabled={currentPage === pageCount}
            className="inline-flex h-9 items-center gap-2 rounded-full border border-border px-3 text-sm disabled:cursor-not-allowed disabled:opacity-40"
          >
            Вперёд <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {showAdd && (
        <AddPriceDialog
          services={services}
          onClose={() => setShowAdd(false)}
          onCreated={() => {
            setShowAdd(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function AddPriceDialog({
  services, onClose, onCreated,
}: { services: Service[]; onClose: () => void; onCreated: () => void }) {
  const [serviceSlug, setServiceSlug] = useState(services[0]?.slug || "");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    const amountNum = Number(amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      setError("Цена должна быть числом > 0");
      return;
    }
    setPending(true);
    const res = await fetch("/api/price", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ serviceSlug, brand: brand.trim() || undefined, model: model.trim() || undefined, amount: amountNum, note: note.trim() || undefined }),
    });
    const data = await res.json();
    setPending(false);
    if (!res.ok) {
      setError(data?.error || "Не удалось сохранить");
      return;
    }
    onCreated();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="text-lg font-semibold">Новая строка прайса</div>
          <button onClick={onClose} className="rounded-md p-1.5 text-muted-fg hover:bg-muted/40"><X className="h-4 w-4" /></button>
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wider text-muted-fg">Услуга</label>
            <select value={serviceSlug} onChange={(e) => setServiceSlug(e.target.value)} className="input h-10 w-full">
              {services.map((s) => <option key={s.id} value={s.slug}>{s.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wider text-muted-fg">Бренд</label>
              <input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="HP" className="input h-10 w-full" />
            </div>
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wider text-muted-fg">Модель</label>
              <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="CF259A" className="input h-10 w-full" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wider text-muted-fg">Цена, ₽</label>
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="700" className="input h-10 w-full" />
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wider text-muted-fg">Заметка (необязательно)</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Например, акция/специальное предложение" className="input h-10 w-full" />
          </div>
          {error && <div className="text-sm text-red-500">{error}</div>}
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button onClick={onClose} className="inline-flex h-10 items-center rounded-full border border-border bg-card px-4 text-sm font-medium hover:border-primary hover:text-primary">Отмена</button>
          <button onClick={submit} disabled={pending} className="btn-primary h-10 px-4">
            {pending ? "Сохраняем…" : "Добавить"}
          </button>
        </div>
        <p className="mt-3 text-xs text-muted-fg">
          Если оставить бренд и модель пустыми, цена станет базовой для услуги (например, диагностика без привязки к картриджу).
        </p>
      </div>
    </div>
  );
}
