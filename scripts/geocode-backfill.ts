/**
 * Догнать координаты и районы для адресов в БД через Яндекс.Геокодер.
 * Запускать руками после первого ввода YANDEX_GEOCODER_KEY в .env:
 *   npm run geocode:backfill
 *
 * Безопасен повторный запуск — обрабатывает только адреса без координат.
 * Делает паузу 300 мс между запросами, чтобы не упереться в лимиты.
 */
import { PrismaClient } from "@prisma/client";
import { enrichAddress } from "../src/lib/districts";

const prisma = new PrismaClient();

async function main() {
  if (!process.env.YANDEX_GEOCODER_KEY) {
    console.error("✖ YANDEX_GEOCODER_KEY не задан в .env — нечего бэкфиллить.");
    process.exit(1);
  }

  const targets = await prisma.address.findMany({
    where: { OR: [{ lat: null }, { geocodedAt: null }] },
  });
  console.log(`→ К обработке ${targets.length} адресов`);

  let ok = 0;
  let fail = 0;
  for (const a of targets) {
    process.stdout.write(`  ${a.address.slice(0, 60).padEnd(60)} → `);
    const e = await enrichAddress(a.address);
    await prisma.address.update({
      where: { id: a.id },
      data: {
        district: e.district || a.district,
        lat: e.lat,
        lng: e.lng,
        formattedAddress: e.formattedAddress,
        geocodedAt: e.geocodedAt,
      },
    });
    if (e.lat && e.lng) {
      console.log(`✓ ${e.district || "?"} (${e.lat.toFixed(4)},${e.lng.toFixed(4)})`);
      ok++;
    } else {
      console.log(`✖ не геокодировался, остался regex-район «${e.district || "—"}»`);
      fail++;
    }
    // Бережный rate-limit
    await new Promise((r) => setTimeout(r, 300));
  }

  console.log(`\n✓ Обработано: ${ok} с координатами, ${fail} fallback на regex`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
