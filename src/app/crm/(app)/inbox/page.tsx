import { InboxView } from "@/components/crm/InboxView";

export const dynamic = "force-dynamic";

export default function InboxPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  return <InboxView initialClientIdPromise={searchParams.then((s) => s.c || null)} />;
}
