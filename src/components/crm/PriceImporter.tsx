"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, CheckCircle2, AlertCircle } from "lucide-react";

type SheetResult = { created: number; updated: number; skipped: number; errors: string[] };
type ImportResult = {
  error?: string;
  created?: number;
  updated?: number;
  skipped?: number;
  errors?: number;
  sheets?: Record<string, SheetResult>;
};

export function PriceImporter() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setPending(true);
    setResult(null);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/price/import", { method: "POST", body: fd });
    const data: ImportResult = await res.json();
    setResult(data);
    setPending(false);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <input
        type="file"
        accept=".xlsx,.xls,.csv"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
        className="block text-sm"
      />
      <button
        type="submit"
        disabled={!file || pending}
        className="btn-primary disabled:opacity-50"
      >
        <Upload className="h-4 w-4" /> {pending ? "Загрузка…" : "Загрузить"}
      </button>

      {result?.error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/[0.06] p-3 text-sm text-red-600">
          <AlertCircle className="mr-1 inline h-4 w-4" /> {result.error}
        </div>
      )}

      {result?.sheets && (
        <div className="rounded-xl border border-border bg-bg-2 p-4 text-sm">
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            Импорт завершён: создано {result.created || 0} · обновлено {result.updated || 0}
            {result.skipped ? ` · пропущено ${result.skipped}` : ""}
            {result.errors ? ` · ошибок ${result.errors}` : ""}
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {Object.entries(result.sheets).map(([sheet, r]) => (
              <div key={sheet} className="rounded-lg border border-border bg-card p-3">
                <div className="font-medium">{sheet}</div>
                <div className="mt-1 text-xs text-muted-fg">
                  +{r.created} новых · {r.updated} обновлено
                  {r.skipped ? ` · ${r.skipped} пропущено` : ""}
                  {r.errors.length ? ` · ${r.errors.length} ошибок` : ""}
                </div>
                {r.errors.length > 0 && (
                  <ul className="mt-2 max-h-32 overflow-y-auto text-xs text-red-600 space-y-0.5">
                    {r.errors.slice(0, 8).map((e, i) => (
                      <li key={i} className="truncate" title={e}>· {e}</li>
                    ))}
                    {r.errors.length > 8 && (
                      <li className="text-muted-fg">…ещё {r.errors.length - 8}</li>
                    )}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </form>
  );
}
