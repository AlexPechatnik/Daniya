import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
      <div aria-hidden className="absolute inset-0 bg-grid mask-fade-edges opacity-40" />
      <div className="relative">
        <div className="heading-display text-8xl md:text-9xl text-gradient">404</div>
        <p className="mt-5 text-muted-fg max-w-md">Страница не найдена. Возможно, ссылка устарела.</p>
        <Link href="/" className="btn-primary btn-glow mt-8 px-6 py-3.5">На главную</Link>
      </div>
    </div>
  );
}
