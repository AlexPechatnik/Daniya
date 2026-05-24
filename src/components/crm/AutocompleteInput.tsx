"use client";

import { useEffect, useState } from "react";

interface Suggestion {
  value: string;
  title: string;
  subtitle?: string;
  kind?: string;
}

export function AutocompleteInput({
  endpoint,
  value,
  onChange,
  placeholder,
  minLength,
  className = "input h-12 text-base",
  name,
  required,
}: {
  endpoint: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  minLength: number;
  className?: string;
  /** Имя поля для отправки в formData (server actions) */
  name?: string;
  required?: boolean;
}) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = value.trim();
    if (q.length < minLength) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`${endpoint}?q=${encodeURIComponent(q)}`, { signal: controller.signal });
        const data = await res.json();
        const next = data.suggestions || [];
        setSuggestions(next);
        setOpen(next.length > 0);
      } catch (error: any) {
        if (error?.name !== "AbortError") setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 180);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [endpoint, minLength, value]);

  return (
    <div className="relative">
      <input
        className={className}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => setOpen(suggestions.length > 0)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        placeholder={placeholder}
        autoComplete="off"
        name={name}
        required={required}
      />
      {loading && (
        <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-fg">
          поиск
        </div>
      )}
      {open && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 max-h-64 overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl shadow-slate-900/12">
          {suggestions.map((suggestion) => (
            <button
              key={`${suggestion.kind || "item"}:${suggestion.value}`}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange(suggestion.value);
                setOpen(false);
              }}
              className="block w-full border-b border-border/60 px-3 py-2.5 text-left last:border-b-0 hover:bg-muted/45"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium">{suggestion.title}</span>
                {suggestion.kind && <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-fg">{suggestion.kind}</span>}
              </div>
              {suggestion.subtitle && <div className="mt-0.5 text-xs text-muted-fg">{suggestion.subtitle}</div>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
