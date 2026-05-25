/**
 * Импорт каталога принтеров и связки «принтер ↔ картридж» из prisma/data/printers.json
 * (исходник — ТОП-100 принтеров СПб/РФ + блок Epson).
 *
 * Идея: клиент в форме пишет модель принтера, мы по этому каталогу подсказываем,
 * какие картриджи к нему подходят. Картриджи, которых ещё нет в базе, создаются
 * автоматически (без цены — добавите потом через CRM или seed).
 *
 * Запуск: npm run seed:printers
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const prisma = new PrismaClient();

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

/**
 * Из строки "LaserJet Pro M404dn / M404dw / M404n" получаем:
 *   family  = "LaserJet Pro M404dn"
 *   aliases = ["LaserJet Pro M404dn", "LaserJet Pro M404dw", "LaserJet Pro M404n",
 *              "M404dn", "M404dw", "M404n"]
 *
 * — короткие алиасы помогают, когда клиент пишет «м404» вместо полного имени.
 */
function parseFamily(model: string): { family: string; aliases: string[] } {
  const variants = model.split("/").map((s) => s.trim()).filter(Boolean);
  if (variants.length === 0) return { family: model, aliases: [model] };
  const family = variants[0];
  // Префикс семейства = всё до последнего слова в первом варианте
  const firstWords = family.split(" ");
  const prefix = firstWords.slice(0, -1).join(" ");
  // Из остальных вариантов часто идут только хвосты ("M404dw") — наращиваем префиксом
  const fullVariants = variants.map((v) => (v.includes(" ") || !prefix ? v : `${prefix} ${v}`));
  // Короткие хвосты (последнее слово каждой вариации) — отдельно, для поиска по «m404»
  const shortTails = variants.map((v) => v.split(" ").pop()!).filter((t) => t && t.length >= 2);
  const aliases = Array.from(new Set([...fullVariants, ...shortTails]));
  return { family, aliases };
}

/**
 * "CF259A 59A" → { code: "CF259A", short: "59A" }
 * "TK-1110"    → { code: "TK-1110", short: null }
 * "EcoTank 664 BK/C/M/Y" → { code: "EcoTank 664", short: null }
 */
function parseCartridge(raw: string): { code: string; short: string | null } | null {
  const s = raw.trim();
  if (!s) return null;
  // Особый случай: коды Epson EcoTank/E... — оставляем как есть, без обрезки
  if (/^EcoTank/i.test(s) || /^(T\d{3,}|003|001|005|664|673|103|108|057)/i.test(s)) {
    return { code: s.replace(/\s*(BK|C|M|Y|LC|LM|GY|BL|PBK|MK)(\/(BK|C|M|Y|LC|LM|GY|BL|PBK|MK))*$/i, "").trim(), short: null };
  }
  // По умолчанию: первое «словo» — основной код, остальное — короткий алиас
  const parts = s.split(/\s+/);
  return { code: parts[0], short: parts.slice(1).join(" ") || null };
}

async function main() {
  const dataPath = resolve(process.cwd(), "prisma/data/printers.json");
  const rows: Row[] = JSON.parse(readFileSync(dataPath, "utf-8"));
  console.log(`→ ${rows.length} моделей в источнике`);

  let printersUpserted = 0;
  let cartridgesCreated = 0;
  let linksCreated = 0;

  for (const r of rows) {
    const { family, aliases } = parseFamily(r.model);
    const brand = r.brand.trim();
    const isInkjet = /струйн|EcoTank|Epson/i.test(r.kind) || brand === "Epson";

    const printer = await prisma.printerModel.upsert({
      where: { brand_family: { brand, family } },
      create: {
        brand,
        family,
        aliases: JSON.stringify(aliases),
        kind: r.kind || null,
        segment: r.segment || null,
        demand: r.demand || null,
        chipNote: r.chipNote || null,
      },
      update: {
        aliases: JSON.stringify(aliases),
        kind: r.kind || null,
        segment: r.segment || null,
        demand: r.demand || null,
        chipNote: r.chipNote || null,
      },
    });
    printersUpserted++;

    for (const raw of r.cartridges) {
      const parsed = parseCartridge(raw);
      if (!parsed) continue;
      const code = parsed.code;
      // Создаём картридж, если его ещё нет (по brand+model). Цена — отдельно через seed.
      const cart = await prisma.cartridge.upsert({
        where: { brand_model: { brand, model: code } },
        create: {
          brand,
          model: code,
          type: isInkjet ? "струйный" : "лазерный",
          hasChip: r.chip === "Да",
          chipPrice: r.chip === "Да" ? 150 * 100 : null,
          compatible: r.model, // в каком принтере встречается
        },
        update: {
          // не перетираем hasChip/compatible, если уже задано вручную
        },
      });
      if (cart.createdAt && cart.createdAt.getTime() > Date.now() - 5000) cartridgesCreated++;

      // Связка M:N — идемпотентно
      try {
        await prisma.printerCartridge.create({
          data: { printerModelId: printer.id, cartridgeId: cart.id },
        });
        linksCreated++;
      } catch {
        // уже есть — игнор
      }
    }
  }

  console.log(`✓ Принтеров (upsert): ${printersUpserted}`);
  console.log(`✓ Новых картриджей: ~${cartridgesCreated}`);
  console.log(`✓ Связок принтер↔картридж: ${linksCreated}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
