"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";

export function PriceImporter() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<any>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setPending(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/price/import", { method: "POST", body: fd });
    const data = await res.json();
    setResult(data);
    setPending(false);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => setFile(e.target.files?.[0] || null)} className="block text-sm" />
      <button type="submit" disabled={!file || pending} className="btn-primary">
        <Upload className="h-4 w-4" /> {pending ? "Загрузка…" : "Загрузить"}
      </button>
      {result && (
        <div className="mt-2 rounded-lg border p-3 text-sm">
          <div>Создано: {result.created} · Обновлено: {result.updated} · Пропущено: {result.skipped}</div>
          {result.errors?.length > 0 && (
            <ul className="mt-2 text-red-600 text-xs space-y-1">
              {result.errors.slice(0, 5).map((e: string, i: number) => <li key={i}>{e}</li>)}
            </ul>
          )}
        </div>
      )}
    </form>
  );
}
