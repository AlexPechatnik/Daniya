import { TodayFeed } from "@/components/crm/TodayFeed";
import { DashboardMobile } from "@/components/crm/mobile/DashboardMobile";
import { MasterMobileDashboard } from "@/components/crm/MasterMobileDashboard";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function CrmHome() {
  const user = await requireUser();
  if (user.role !== "ADMIN") return <MasterMobileDashboard />;
  return (
    <>
      <div className="hidden lg:block">
        <TodayFeed />
      </div>
      <div className="lg:hidden">
        <DashboardMobile />
      </div>
    </>
  );
}
