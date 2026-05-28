import { InboxView } from "@/components/crm/InboxView";
import { InboxMobile } from "@/components/crm/mobile/InboxMobile";

export const dynamic = "force-dynamic";

export default function InboxPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const initialClientIdPromise = searchParams.then((s) => s.c || null);
  return (
    <>
      {/* Десктоп: 3-колоночный layout (список / чат / контекст клиента) */}
      <div className="hidden lg:block">
        <InboxView initialClientIdPromise={initialClientIdPromise} />
      </div>
      {/* Мобайл: full-screen список → full-screen чат с back */}
      <div className="lg:hidden">
        <InboxMobile initialClientIdPromise={initialClientIdPromise} />
      </div>
    </>
  );
}
