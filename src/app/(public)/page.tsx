import { Hero } from "@/components/Hero";
import { BrandsMarquee } from "@/components/BrandsMarquee";
import { Services } from "@/components/Services";
import { OnSiteOrSwap } from "@/components/OnSiteOrSwap";
import { HowItWorks } from "@/components/HowItWorks";
import { WhyUs } from "@/components/WhyUs";
import { UnderTheHood } from "@/components/UnderTheHood";
import { Calculator } from "@/components/Calculator";
import { ContactChannels } from "@/components/ContactChannels";
import { RequestForm } from "@/components/RequestForm";
import { prisma } from "@/lib/db";

export default async function HomePage() {
  const services = await prisma.service.findMany({ orderBy: { name: "asc" } });
  const cartridges = await prisma.cartridge.findMany({
    include: { prices: { where: { service: { kind: "REFILL" } }, take: 1 } },
    orderBy: [{ isPopular: "desc" }, { brand: "asc" }, { model: "asc" }],
    take: 80,
  });
  const cartridgesPlain = cartridges.map((c) => ({
    id: c.id, brand: c.brand, model: c.model, type: c.type,
    isPopular: c.isPopular, isOriginal: c.isOriginal,
    price: c.prices[0]?.amount ?? null,
  }));

  return (
    <>
      <Hero />
      <BrandsMarquee />
      <Services />
      <OnSiteOrSwap />
      <HowItWorks />
      <WhyUs />
      <UnderTheHood />
      <Calculator services={services.map((s) => ({ id: s.id, name: s.name, kind: s.kind, slug: s.slug }))} cartridges={cartridgesPlain} />
      <ContactChannels />
      <RequestForm />
    </>
  );
}
