import { MasterMobileDashboard } from "@/components/crm/MasterMobileDashboard";

export const dynamic = "force-dynamic";

export default async function CrmMobilePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  return <MasterMobileDashboard tab={tab} />;
}
