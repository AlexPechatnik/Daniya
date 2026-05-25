import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { detectDistrict } from "../src/lib/districts";
import { seedPrintersAndCartridges } from "../scripts/seed-printers";

const prisma = new PrismaClient();

// Цены в рублях, ориентир по СПб на 2026.
// Источник — медианные цены сервисов СПб 2025–2026 (rusprinter, allcartridges,
// xerox-spb, mfu-pro, нижняя/верхняя планка частных мастеров).
//   Заправка лазерного — 500–900 ₽, медиана 600 ₽.
//   Замена картриджа (только работа выезда) — 500–800 ₽, медиана 700 ₽.
//   Диагностика на месте — 500–1000 ₽, медиана 700 ₽ (бесплатно при заказе ремонта).
//   Ремонт принтера от 1500 ₽; чистка струйной головки 1000–2000 ₽; СНПЧ 2500–4500 ₽.
const services: { name: string; slug: string; kind: string; base?: number }[] = [
  { name: "Заправка картриджа",          slug: "zapravka",     kind: "REFILL",     base: 600 },
  { name: "Замена картриджа (работа)",   slug: "zamena",       kind: "REPLACE",    base: 700 },
  { name: "Диагностика принтера",        slug: "diagnostika",  kind: "DIAGNOSTIC", base: 700 },
  { name: "Ремонт принтера",             slug: "remont",       kind: "REPAIR",     base: 1500 },
];

// hasChip — у картриджа есть антизаправочный чип, требует замены при каждой заправке.
// Это типичная цена замены чипа в СПб 100–300 ₽. Дефолт — 150 ₽ (см. CHIP_PRICE_DEFAULT).
// pageYield — заводской ресурс в страницах при 5% заполнении (нужно для прайса/факта).
type CartridgeSeed = {
  brand: string; model: string; type: string;
  popular?: boolean; hasChip?: boolean;
  refill: number;            // ₽
  pageYield?: number;        // страниц
  compatible?: string;
};

const cartridges: CartridgeSeed[] = [
  // ─── HP лазер ─────────────────────────────────────────────────────────────
  // Серия CF2xx и новее — Dynamic Security, чип обязателен.
  { brand: "HP", model: "CF283A", type: "лазерный", popular: true, hasChip: true,  refill: 600, pageYield: 1500, compatible: "LaserJet M125, M127, M201, M225" },
  { brand: "HP", model: "CF283X", type: "лазерный", popular: true, hasChip: true,  refill: 750, pageYield: 2200, compatible: "LaserJet M201, M225" },
  { brand: "HP", model: "CF217A", type: "лазерный", popular: true, hasChip: true,  refill: 650, pageYield: 1600, compatible: "LaserJet M102, M130" },
  { brand: "HP", model: "CF218A", type: "лазерный",                hasChip: true,  refill: 650, pageYield: 1400, compatible: "LaserJet M104, M132" },
  { brand: "HP", model: "CF230A", type: "лазерный", popular: true, hasChip: true,  refill: 700, pageYield: 1600, compatible: "LaserJet M203, M227" },
  { brand: "HP", model: "CF230X", type: "лазерный",                hasChip: true,  refill: 850, pageYield: 3500, compatible: "LaserJet M203, M227" },
  { brand: "HP", model: "CF259A", type: "лазерный", popular: true, hasChip: true,  refill: 800, pageYield: 3000, compatible: "LaserJet M404, M428" },
  { brand: "HP", model: "CF259X", type: "лазерный",                hasChip: true,  refill: 1000, pageYield: 10000, compatible: "LaserJet M404, M428" },
  { brand: "HP", model: "CE285A", type: "лазерный", popular: true,                 refill: 550, pageYield: 1600, compatible: "LaserJet P1102, M1132" },
  { brand: "HP", model: "CB435A", type: "лазерный",                                refill: 550, pageYield: 1500, compatible: "LaserJet P1005, P1006" },
  { brand: "HP", model: "CB436A", type: "лазерный",                                refill: 550, pageYield: 2000, compatible: "LaserJet P1505, M1120" },
  { brand: "HP", model: "Q2612A", type: "лазерный",                                refill: 500, pageYield: 2000, compatible: "LaserJet 1010, 1020, 3050" },
  { brand: "HP", model: "Q7553A", type: "лазерный",                                refill: 600, pageYield: 3000, compatible: "LaserJet P2014, P2015" },
  { brand: "HP", model: "CF226A", type: "лазерный",                hasChip: true,  refill: 800, pageYield: 3100, compatible: "LaserJet M402, M426" },
  // ─── Canon лазер ──────────────────────────────────────────────────────────
  { brand: "Canon", model: "725",   type: "лазерный", popular: true, hasChip: true, refill: 600, pageYield: 1600, compatible: "LBP6000, LBP6020, MF3010" },
  { brand: "Canon", model: "728",   type: "лазерный", popular: true, hasChip: true, refill: 650, pageYield: 2100, compatible: "MF4410, MF4570, MF4730" },
  { brand: "Canon", model: "737",   type: "лазерный", popular: true, hasChip: true, refill: 700, pageYield: 2400, compatible: "MF211, MF212, MF217, MF229" },
  { brand: "Canon", model: "719",   type: "лазерный",                               refill: 650, pageYield: 2100, compatible: "LBP6300, MF5840" },
  { brand: "Canon", model: "703",   type: "лазерный",                               refill: 550, pageYield: 2000, compatible: "LBP2900, LBP3000" },
  { brand: "Canon", model: "712",   type: "лазерный",                               refill: 550, pageYield: 1500, compatible: "LBP3010, LBP3100" },
  { brand: "Canon", model: "FX-10", type: "лазерный",                               refill: 550, pageYield: 2000, compatible: "MF4018, MF4140, L100" },
  // ─── Samsung — почти все с чипами ─────────────────────────────────────────
  { brand: "Samsung", model: "MLT-D101S", type: "лазерный", popular: true, hasChip: true, refill: 650, pageYield: 1500, compatible: "ML-2160, ML-2165, SCX-3400" },
  { brand: "Samsung", model: "MLT-D104S", type: "лазерный",                hasChip: true, refill: 650, pageYield: 1500, compatible: "ML-1660, ML-1860, SCX-3200" },
  { brand: "Samsung", model: "MLT-D111S", type: "лазерный", popular: true, hasChip: true, refill: 700, pageYield: 1000, compatible: "M2020, M2070" },
  { brand: "Samsung", model: "MLT-D108S", type: "лазерный",                hasChip: true, refill: 650, pageYield: 1500, compatible: "ML-1640, ML-2240" },
  { brand: "Samsung", model: "MLT-D205L", type: "лазерный",                hasChip: true, refill: 800, pageYield: 5000, compatible: "ML-3310, ML-3710, SCX-4833" },
  // ─── Brother ──────────────────────────────────────────────────────────────
  { brand: "Brother", model: "TN-1075", type: "лазерный", popular: true,                  refill: 600, pageYield: 1000, compatible: "HL-1110, DCP-1510, MFC-1815" },
  { brand: "Brother", model: "TN-2080", type: "лазерный",                                 refill: 700, pageYield: 700,  compatible: "HL-2130, DCP-7055" },
  { brand: "Brother", model: "TN-2275", type: "лазерный",                hasChip: true,   refill: 700, pageYield: 2600, compatible: "HL-2240, MFC-7860" },
  // ─── Xerox ────────────────────────────────────────────────────────────────
  { brand: "Xerox", model: "106R02773", type: "лазерный",              hasChip: true, refill: 700, pageYield: 1500, compatible: "Phaser 3020, WC 3025" },
  { brand: "Xerox", model: "106R01487", type: "лазерный",              hasChip: true, refill: 750, pageYield: 4100, compatible: "WorkCentre 3210, 3220" },
  // ─── Kyocera ──────────────────────────────────────────────────────────────
  { brand: "Kyocera", model: "TK-1110", type: "лазерный",              hasChip: true, refill: 800, pageYield: 2500, compatible: "FS-1040, FS-1020, FS-1120" },
  { brand: "Kyocera", model: "TK-1120", type: "лазерный",              hasChip: true, refill: 850, pageYield: 3000, compatible: "FS-1025, FS-1060, FS-1125" },
  { brand: "Kyocera", model: "TK-1170", type: "лазерный",              hasChip: true, refill: 900, pageYield: 7200, compatible: "M2040, M2540, M2640" },
  // ─── Ricoh ────────────────────────────────────────────────────────────────
  { brand: "Ricoh", model: "SP 150HE", type: "лазерный",               hasChip: true, refill: 750, pageYield: 1500, compatible: "SP 150, SP 150SU" },
  // ─── Pantum ───────────────────────────────────────────────────────────────
  { brand: "Pantum", model: "PC-211EV", type: "лазерный",                              refill: 600, pageYield: 1600, compatible: "P2200, P2207, M6500, M6550" },
  // ─── Epson струйные «бутылки» EcoTank ─────────────────────────────────────
  { brand: "Epson", model: "664",  type: "струйный", popular: true,                    refill: 400, pageYield: 6500, compatible: "L120, L222, L312, L366, L486, L1300 (EcoTank)" },
  { brand: "Epson", model: "003",  type: "струйный",                                   refill: 400, pageYield: 4500, compatible: "L3100, L3110, L3150, L5190" },
  { brand: "Epson", model: "103",  type: "струйный",                                   refill: 400, pageYield: 7500, compatible: "L3100, L3110, L3151, L3156" },
];

const CHIP_PRICE_DEFAULT = 150; // ₽ — дефолтная цена замены чипа

async function main() {
  console.log("→ Seeding services...");
  for (const s of services) {
    await prisma.service.upsert({
      where: { slug: s.slug },
      create: { name: s.name, slug: s.slug, kind: s.kind },
      update: { name: s.name, kind: s.kind },
    });
  }

  console.log("→ Seeding cartridges & refill prices...");
  const refillService = await prisma.service.findUnique({ where: { slug: "zapravka" } });
  for (const c of cartridges) {
    const cart = await prisma.cartridge.upsert({
      where: { brand_model: { brand: c.brand, model: c.model } },
      create: {
        brand: c.brand, model: c.model, type: c.type,
        compatible: c.compatible, isPopular: c.popular || false,
        hasChip: c.hasChip || false,
        chipPrice: c.hasChip ? CHIP_PRICE_DEFAULT * 100 : null,
        pageYield: c.pageYield ?? null,
      },
      update: {
        isPopular: c.popular || false,
        compatible: c.compatible,
        hasChip: c.hasChip || false,
        chipPrice: c.hasChip ? CHIP_PRICE_DEFAULT * 100 : null,
        pageYield: c.pageYield ?? null,
      },
    });
    if (refillService) {
      const existing = await prisma.price.findFirst({ where: { serviceId: refillService.id, cartridgeId: cart.id } });
      if (existing) {
        await prisma.price.update({ where: { id: existing.id }, data: { amount: c.refill * 100 } });
      } else {
        await prisma.price.create({ data: { serviceId: refillService.id, cartridgeId: cart.id, amount: c.refill * 100 } });
      }
    }
  }

  console.log("→ Base service prices...");
  for (const s of services) {
    if (!s.base) continue;
    const svc = await prisma.service.findUnique({ where: { slug: s.slug } });
    if (!svc) continue;
    const exists = await prisma.price.findFirst({ where: { serviceId: svc.id, cartridgeId: null } });
    if (!exists) {
      await prisma.price.create({ data: { serviceId: svc.id, amount: s.base * 100, note: "Базовая цена" } });
    }
  }

  // Каталог принтеров (138 моделей) + связи с картриджами из prisma/data/printers.json
  console.log("→ Seeding printer catalog + cartridge compatibility...");
  await seedPrintersAndCartridges(prisma);

  // Backfill: проставить район у адресов, где он ещё пустой (после миграции)
  console.log("→ Backfilling districts for existing addresses...");
  const addresses = await prisma.address.findMany({ where: { district: null } });
  let backfilled = 0;
  for (const a of addresses) {
    const d = detectDistrict(a.address);
    if (d) {
      await prisma.address.update({ where: { id: a.id }, data: { district: d } });
      backfilled++;
    }
  }
  if (backfilled) console.log(`  → проставили район у ${backfilled} адресов`);

  console.log("→ Seeding users (admin + master)...");
  // Если уже есть пользователи — не трогаем. Пароли первого запуска показываем в консоль.
  const existing = await prisma.user.count();
  const adminPass = await bcrypt.hash("admin123", 10);
  const masterPass = await bcrypt.hash("master123", 10);
  await prisma.user.upsert({
    where: { email: "admin@example.ru" },
    create: { email: "admin@example.ru", name: "Администратор", role: "ADMIN", password: adminPass, color: "#2563eb" },
    update: {},
  });
  await prisma.user.upsert({
    where: { email: "master@example.ru" },
    create: { email: "master@example.ru", name: "Иван (мастер)", role: "MASTER", password: masterPass, color: "#10b981" },
    update: {},
  });

  if (existing === 0) {
    console.log("");
    console.log("┌──────────────────────────────────────────────────────────┐");
    console.log("│  ДЕМО-ПОЛЬЗОВАТЕЛИ — поменяйте пароли через CRM (или БД) │");
    console.log("│  Админ:  admin@example.ru  /  admin123                   │");
    console.log("│  Мастер: master@example.ru /  master123                  │");
    console.log("└──────────────────────────────────────────────────────────┘");
    console.log("");
  } else {
    console.log("  (пользователи уже есть — пароли не трогаем)");
  }
  console.log("✓ Done");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
