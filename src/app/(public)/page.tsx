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
  // Источник правды — общий с /price и CRM: prisma.service + prisma.price.
  // Загружаем все картриджи (без take), сразу все их цены + базовые ставки
  // услуг (Price без cartridgeId), чтобы калькулятор честно считал по любому
  // выбранному сегменту, а не подменял заправкой.
  const [services, cartridges, basePrices] = await Promise.all([
    prisma.service.findMany({ orderBy: { name: "asc" } }),
    prisma.cartridge.findMany({
      // В калькулятор не пускаем «чернила» — для струйки используется
      // отдельный сценарий (форма заявки → услуга обслуживания).
      where: { NOT: { type: "струйный" } },
      include: { prices: { select: { serviceId: true, amount: true } } },
      orderBy: [{ isPopular: "desc" }, { brand: "asc" }, { model: "asc" }],
    }),
    prisma.price.findMany({ where: { cartridgeId: null }, select: { serviceId: true, amount: true } }),
  ]);

  const baseByService: Record<string, number> = {};
  for (const p of basePrices) baseByService[p.serviceId] = p.amount;

  const cartridgesPlain = cartridges.map((c) => {
    const priceByService: Record<string, number> = {};
    for (const p of c.prices) priceByService[p.serviceId] = p.amount;
    return {
      id: c.id,
      brand: c.brand,
      model: c.model,
      type: c.type,
      isPopular: c.isPopular,
      isOriginal: c.isOriginal,
      hasChip: c.hasChip,
      chipPrice: c.chipPrice,
      compatible: c.compatible || null, // чтобы поиск ловил «M404» и т.п.
      priceByService, // serviceId → ₽ (копейки), как в /price и CRM
    };
  });

  return (
    <>
      <Hero />
      <BrandsMarquee />
      <Services />
      <OnSiteOrSwap />
      <HowItWorks />
      <WhyUs />
      <UnderTheHood />
      <Calculator
        services={services.map((s) => ({
          id: s.id, name: s.name, kind: s.kind, slug: s.slug,
          cartridgeBased: s.cartridgeBased,
        }))}
        cartridges={cartridgesPlain}
        baseByService={baseByService}
      />
      <ContactChannels />
      <RequestForm />
    </>
  );
}
