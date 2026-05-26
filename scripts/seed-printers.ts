/**
 * Импорт каталога принтеров и связки «принтер ↔ картридж» из prisma/data/printers.json
 * (исходник — ТОП-100 принтеров СПб/РФ + блок Epson). Всего ~138 моделей.
 *
 * Зачем: клиент в форме пишет модель принтера — мы по этому каталогу подсказываем,
 * какие картриджи к нему подходят. Картриджи и цены заправки, которых ещё нет
 * в базе, создаются автоматически с дефолтными ценами по СПб.
 *
 * Запуск:
 *   npm run seed:printers     — самостоятельно
 *   npm run db:seed           — вызывается из основного сидинга
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { shortenSpbAddress } from "../src/lib/address";

type Row = {
  rank: string;
  brand: string;
  model: string;          // "LaserJet Pro M404dn / M404dw / M404n"
  kind: string;
  segment: string;
  cartridges: string[];   // ["CF259A 59A", "CF259X 59X"]
  yield: string;
  chip: string;
  chipNote: string;
  demand: string;
};

const CHIP_PRICE_DEFAULT = 150; // ₽ — типичная цена замены чипа в СПб

/**
 * Из строки "LaserJet Pro M404dn / M404dw / M404n" получаем:
 *   family  = "LaserJet Pro M404dn"
 *   aliases = ["LaserJet Pro M404dn", "LaserJet Pro M404dw", "LaserJet Pro M404n",
 *              "M404dn", "M404dw", "M404n"]
 */
function parseFamily(model: string): { family: string; aliases: string[] } {
  const variants = model.split("/").map((s) => s.trim()).filter(Boolean);
  if (variants.length === 0) return { family: model, aliases: [model] };
  const family = variants[0];
  const firstWords = family.split(" ");
  const prefix = firstWords.slice(0, -1).join(" ");
  const fullVariants = variants.map((v) => (v.includes(" ") || !prefix ? v : `${prefix} ${v}`));
  const shortTails = variants.map((v) => v.split(" ").pop()!).filter((t) => t && t.length >= 2);
  const aliases = Array.from(new Set([...fullVariants, ...shortTails]));
  return { family, aliases };
}

/** Шумовые токены/цвета — не картриджи. */
const SKIP_EXACT = new Set([
  "СНПЧ", "ПЗК", "C", "M", "Y", "LC", "LM", "BK", "BLACK",
  "CYAN", "MAGENTA", "YELLOW", "GY", "BL", "PBK", "MK",
]);

/**
 * Извлекает канонические коды картриджей из одной строки таблицы.
 * Может вернуть несколько: «Чернила 003 или 103 BK/C/M/Y» → ["003", "103"].
 */
function extractCodes(raw: string): string[] {
  let s = raw.trim();
  if (!s) return [];
  // Префиксы «Чернила», «Тонер», вынесённый бренд
  s = s.replace(/^(?:Чернила|Тонер)\s+/i, "");
  s = s.replace(/^drum\s+/i, "");
  s = s.replace(/^(?:Canon|HP|Brother|Epson|Xerox|Samsung|Kyocera|Ricoh|Pantum|OKI)\s+/i, "");

  // Разделители вариантов: «или», «и», «/»
  const alts = s.split(/\s+(?:или|и)\s+|\s*\/\s*/);
  const out: string[] = [];
  for (const part of alts) {
    let p = part.trim();
    if (!p) continue;
    p = p.replace(/[–—]/g, "-");
    let code = (p.split(/\s+/)[0] || "").toUpperCase();
    // Если это диапазон вида T0811-T0816 — берём первый
    if (/-T?\d/.test(code)) {
      const m = code.match(/^([A-Z]*\d+[A-Z]*)/);
      if (m) code = m[1];
    }
    code = code.replace(/[^A-Z0-9-]/g, "");
    if (!code || code.length < 2) continue;
    if (SKIP_EXACT.has(code)) continue;
    if (!/\d/.test(code)) continue; // у настоящих кодов всегда есть цифры
    out.push(code);
  }
  return Array.from(new Set(out));
}

/** Угадывает бренд картриджа по коду — Pantum-принтер может содержать «Canon 047». */
function inferBrand(code: string, fallback: string): string {
  if (/^MLT-/i.test(code)) return "Samsung";
  if (/^TN-|^DR-/i.test(code)) return "Brother";
  if (/^TK-/i.test(code)) return "Kyocera";
  if (/^TL-/i.test(code)) return "Pantum";
  if (/^PC-|^PA-/i.test(code)) return "Pantum";
  if (/^SP/i.test(code)) return "Ricoh";
  if (/^CF|^CE|^CB|^Q\d|^W\d/i.test(code)) return "HP";
  if (/^CRG|^GPR-|^EP-|^FX-/i.test(code)) return "Canon";
  if (/^006R|^108R|^106R/i.test(code)) return "Xerox";
  if (/^(?:45807|44574|45103|44315)\d+$/.test(code)) return "OKI";
  return fallback;
}

/** Тип картриджа: лазерный/струйный. */
function detectType(brand: string, code: string, printerKind: string): "лазерный" | "струйный" {
  const lower = (printerKind || "").toLowerCase();
  if (lower.includes("струй") || lower.includes("ecotank") || lower.includes("ink")) return "струйный";
  if (brand === "Epson" && /^\d{3}$|^T\d/i.test(code)) return "струйный";
  return "лазерный";
}

/** Дефолтная цена заправки в ₽ — медианы по СПб 2025–2026. */
function defaultRefillPrice(brand: string, code: string, type: string): number {
  if (type === "струйный") return 400;
  if (/^DR-/i.test(code)) return 1500; // барабан — отдельная услуга
  switch (brand) {
    case "Kyocera": return 800;
    case "Brother": return 700;
    case "Samsung": return 700;
    case "Xerox":   return 700;
    case "Ricoh":   return 750;
    case "OKI":     return 800;
    case "Pantum":  return 600;
    case "HP":
    case "Canon":
    default:        return 650;
  }
}

function shouldAppearInRefillPrice(type: string): boolean {
  return type === "лазерный";
}

function parseYields(raw?: string): number[] {
  if (!raw) return [];
  return Array.from(raw.matchAll(/\d[\d\s]{0,5}/g))
    .map((m) => Number(m[0].replace(/\s/g, "")))
    .filter((n) => n > 0);
}

export async function seedPrintersAndCartridges(prisma: PrismaClient) {
  const dataPath = resolve(process.cwd(), "prisma/data/printers.json");
  const rows: Row[] = JSON.parse(readFileSync(dataPath, "utf-8"));
  console.log(`  ↳ ${rows.length} моделей в источнике`);

  const refillService = await prisma.service.findUnique({ where: { slug: "zapravka" } });
  if (!refillService) throw new Error("Сервис 'zapravka' не найден — сначала запусти основной seed");

  // Очистка legacy: «чернила» Epson/HP/Canon, которые когда-то сидились как
  // картриджи лазерной модели — теперь не наш расходник. Сначала чистим Price,
  // потом Cartridge: onDelete на Price.cartridge — SetNull, без удаления.
  const inkCartridges = await prisma.cartridge.findMany({ where: { type: "струйный" } });
  if (inkCartridges.length > 0) {
    const ids = inkCartridges.map((c) => c.id);
    await prisma.price.deleteMany({ where: { cartridgeId: { in: ids } } });
    await prisma.printerCartridge.deleteMany({ where: { cartridgeId: { in: ids } } });
    await prisma.cartridge.deleteMany({ where: { id: { in: ids } } });
    console.log(`  ↳ удалено legacy-чернил: ${inkCartridges.length}`);
  }

  let printersUpserted = 0;
  let cartridgesCreated = 0;
  let pricesCreated = 0;
  let linksCreated = 0;
  let printTypeFixed = 0;
  const cartridgeCache = new Map<string, string>(); // brand|model → id

  /** Определение типа печати по источнику (kind + brand). */
  const detectType = (kind: string | undefined, brand: string): "laser" | "inkjet" =>
    /струй|ecotank|inktank|смарт\s*танк|smart\s*tank|megatank|снпч|deskjet|officejet|inkjet/i.test(kind || "") ||
    brand === "Epson"
      ? "inkjet"
      : "laser";

  for (const r of rows) {
    const { family, aliases } = parseFamily(r.model);
    const brand = r.brand.trim();
    const chipFlag = r.chip === "Да";
    const yields = parseYields(r.yield);

    // printType — явное поле в БД, а не regex на лету. Дефолтим из kind,
    // но дальше CRM может переопределить вручную через xlsx.
    const printType = detectType(r.kind, brand);

    const printer = await prisma.printerModel.upsert({
      where: { brand_family: { brand, family } },
      create: {
        brand, family,
        aliases: JSON.stringify(aliases),
        printType,
        kind: r.kind || null,
        segment: r.segment || null,
        demand: r.demand || null,
        chipNote: r.chipNote || null,
      },
      update: {
        // НЕ перетираем printType при обновлении — админ мог поменять его
        // через xlsx-импорт, и повторный seed не должен этого затирать.
        aliases: JSON.stringify(aliases),
        kind: r.kind || null,
        segment: r.segment || null,
        demand: r.demand || null,
        chipNote: r.chipNote || null,
      },
    });
    printersUpserted++;

    // Сначала собираем уникальные коды из всех строк, чтобы не плодить дубликаты
    const allCodes = new Set<string>();
    for (const raw of r.cartridges) {
      for (const code of extractCodes(raw)) allCodes.add(code);
    }

    let yieldIdx = 0;
    for (const code of allCodes) {
      const cartBrand = inferBrand(code, brand);
      const type = detectType(cartBrand, code, r.kind);
      // Струйные «чернила» больше не создаём как картриджи — для inkjet
      // используется отдельный сценарий (форма заявки → услуги обслуживания).
      if (type === "струйный") {
        yieldIdx++;
        continue;
      }
      const cacheKey = `${cartBrand}|${code}`;
      let cartridgeId = cartridgeCache.get(cacheKey);

      if (!cartridgeId) {
        const existing = await prisma.cartridge.findUnique({
          where: { brand_model: { brand: cartBrand, model: code } },
        });
        if (existing) {
          cartridgeId = existing.id;
          if (chipFlag && !existing.hasChip) {
            await prisma.cartridge.update({
              where: { id: existing.id },
              data: { hasChip: true, chipPrice: CHIP_PRICE_DEFAULT * 100 },
            });
          }
          // Бэкфилл: если у уже существующего картриджа нет цены заправки —
          // ставим дефолт (иначе он не показывается в публичном прайсе).
          const hasRefillPrice = await prisma.price.findFirst({
            where: { serviceId: refillService.id, cartridgeId: existing.id },
          });
          if (!hasRefillPrice && shouldAppearInRefillPrice(existing.type)) {
            const refillPrice = defaultRefillPrice(existing.brand, existing.model, existing.type);
            await prisma.price.create({
              data: {
                serviceId: refillService.id,
                cartridgeId: existing.id,
                amount: refillPrice * 100,
              },
            });
            pricesCreated++;
          }
        } else {
          const pageYield = yields[yieldIdx] ?? null;
          const created = await prisma.cartridge.create({
            data: {
              brand: cartBrand,
              model: code,
              type,
              hasChip: chipFlag,
              chipPrice: chipFlag ? CHIP_PRICE_DEFAULT * 100 : null,
              pageYield,
              isPopular: r.demand === "A",
              compatible: `${brand} ${family}`,
            },
          });
          cartridgeId = created.id;
          cartridgesCreated++;

          // Дефолтная цена заправки — без неё картридж не появится в публичном прайсе
          if (shouldAppearInRefillPrice(type)) {
            const refillPrice = defaultRefillPrice(cartBrand, code, type);
            await prisma.price.create({
              data: {
                serviceId: refillService.id,
                cartridgeId: created.id,
                amount: refillPrice * 100,
              },
            });
            pricesCreated++;
          }
        }
        cartridgeCache.set(cacheKey, cartridgeId);
      }

      // Связка M:N — идемпотентно
      try {
        await prisma.printerCartridge.create({
          data: { printerModelId: printer.id, cartridgeId },
        });
        linksCreated++;
      } catch {
        // уже есть — игнор
      }
      yieldIdx++;
    }
  }

  // Бэкфилл printType: исправляем ошибочные «laser» там, где источник
  // уверенно говорит «inkjet» (Epson EcoTank и т.п.). Делаем только в
  // направлении laser → inkjet, чтобы не затирать осознанные ручные правки
  // через xlsx. Обратные кейсы (Epson, кейс «лазерный») админ правит руками.
  for (const r of rows) {
    const { family } = parseFamily(r.model);
    const expected = detectType(r.kind, r.brand.trim());
    if (expected !== "inkjet") continue;
    const current = await prisma.printerModel.findUnique({
      where: { brand_family: { brand: r.brand.trim(), family } },
      select: { id: true, printType: true },
    });
    if (current && current.printType === "laser") {
      await prisma.printerModel.update({
        where: { id: current.id },
        data: { printType: "inkjet" },
      });
      printTypeFixed++;
    }
  }

  // Финальная подметалка: для каждого картриджа в базе, у которого нет цены
  // заправки, ставим дефолт. Покрывает картриджи, добавленные руками в CRM.
  const removedNonRefillPrices = await prisma.price.deleteMany({
    where: {
      serviceId: refillService.id,
      cartridge: { is: { type: { not: "лазерный" } } },
    },
  });

  const allCartridges = await prisma.cartridge.findMany({ where: { type: "лазерный" } });
  let backfilled = 0;
  for (const c of allCartridges) {
    const hasPrice = await prisma.price.findFirst({
      where: { serviceId: refillService.id, cartridgeId: c.id },
    });
    if (!hasPrice) {
      const refillPrice = defaultRefillPrice(c.brand, c.model, c.type);
      await prisma.price.create({
        data: { serviceId: refillService.id, cartridgeId: c.id, amount: refillPrice * 100 },
      });
      backfilled++;
    }
  }

  // Бэкфилл: укорачиваем уже сохранённые адреса. Старые записи лежат в виде
  // «Россия, Санкт-Петербург, …» — теперь храним и показываем коротко.
  const allAddresses = await prisma.address.findMany({
    select: { id: true, address: true, formattedAddress: true },
  });
  let shortened = 0;
  for (const a of allAddresses) {
    const shortAddr = shortenSpbAddress(a.address);
    const shortFmt = shortenSpbAddress(a.formattedAddress);
    const data: { address?: string; formattedAddress?: string } = {};
    if (shortAddr && shortAddr !== a.address) data.address = shortAddr;
    if (a.formattedAddress && shortFmt && shortFmt !== a.formattedAddress) data.formattedAddress = shortFmt;
    if (Object.keys(data).length > 0) {
      await prisma.address.update({ where: { id: a.id }, data });
      shortened++;
    }
  }

  console.log(
    `  ✓ принтеров: ${printersUpserted}, новых картриджей: ${cartridgesCreated}, ` +
    `новых цен: ${pricesCreated}, связей: ${linksCreated}, бэкфилл-цен: ${backfilled}, ` +
    `убрано не-лазерных цен: ${removedNonRefillPrices.count}, адресов сокращено: ${shortened}, ` +
    `исправлено printType: ${printTypeFixed}`,
  );
}

// CLI-режим: запуск напрямую через `npm run seed:printers`
if (require.main === module) {
  const prisma = new PrismaClient();
  seedPrintersAndCartridges(prisma)
    .then(() => console.log("✓ Каталог принтеров засеян"))
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
}
