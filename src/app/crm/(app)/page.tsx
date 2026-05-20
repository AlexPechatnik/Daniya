import { TodayFeed } from "@/components/crm/TodayFeed";

export const dynamic = "force-dynamic";

export default async function CrmHome() {
  return <TodayFeed />;
}
