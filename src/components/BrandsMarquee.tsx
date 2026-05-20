"use client";

const brands = ["HP", "Canon", "Samsung", "Brother", "Xerox", "Kyocera", "Ricoh", "Pantum", "Epson", "OKI", "Lexmark", "Sharp"];

export function BrandsMarquee() {
  return (
    <section className="border-y border-border bg-bg-2/40">
      <div className="container py-6">
        <div className="flex items-center gap-8">
          <div className="text-xs uppercase tracking-wider text-muted-fg whitespace-nowrap hidden md:block">
            Работаем с моделями
          </div>
          <div className="relative flex-1 overflow-hidden mask-fade-edges">
            <div className="flex gap-12 animate-marquee whitespace-nowrap">
              {[...brands, ...brands].map((b, i) => (
                <div key={i} className="text-2xl font-semibold tracking-tight text-muted-fg/70 hover:text-fg transition">
                  {b}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
