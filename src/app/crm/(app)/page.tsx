import { TodayFeed } from "@/components/crm/TodayFeed";
import { MasterMobileDashboard } from "@/components/crm/MasterMobileDashboard";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function CrmHome() {
  const user = await requireUser();
  if (user.role !== "ADMIN") return <MasterMobileDashboard />;
  return <TodayFeed />;
}
