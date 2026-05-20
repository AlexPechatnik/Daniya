"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";
import { LogIn } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@example.ru");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    setPending(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Ошибка входа");
      return;
    }
    router.push("/crm");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden">
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-grid mask-fade-edges opacity-40" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 h-[400px] w-[400px] bg-primary/15 blur-[120px] rounded-full animate-float-slow" />
      </div>
      <form onSubmit={onSubmit} className="relative card glass p-8 w-full max-w-sm space-y-4">
        <div className="flex justify-center"><Logo /></div>
        <h1 className="text-xl font-semibold text-center tracking-tight">Вход в CRM</h1>
        <div>
          <div className="text-xs font-medium text-muted-fg mb-2 uppercase tracking-wider">Email</div>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <div className="text-xs font-medium text-muted-fg mb-2 uppercase tracking-wider">Пароль</div>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {error && <div className="text-sm text-danger">{error}</div>}
        <button type="submit" disabled={pending} className="btn-primary btn-glow w-full py-3">
          <LogIn className="h-4 w-4" />
          {pending ? "Вход…" : "Войти"}
        </button>
        <p className="text-xs text-muted-fg text-center">Демо: admin@example.ru / admin123</p>
      </form>
    </div>
  );
}
