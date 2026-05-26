import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

/**
 * POST /api/price/import (multipart/form-data, поле `file`)
 *
 * Многоlистовый импорт прайс-системы. Парсит листы, если они есть в файле,
 * и идемпотентно upsert-ит соответствующие сущности:
 *
 *   Услуги         — slug, Название, Категория, Применима к, По картриджу,
 *                    Заметка о цене, Описание, Порядок, Архив, kind
 *   Картриджи      — Бренд, Модель, Тип, Хит, Оригинал, Чип, Цена чипа,
 *                    Ресурс, Совместимость
 *   Принтеры       — Бренд, Семейство, Тип печати, Алиасы, kind, Сегмент,
 *                    Спрос, Заметка о чипе
 *   Совместимость  — Принтер—Бренд, Принтер—Семейство,
 *                    Картридж—Бренд, Картридж—Модель
 *   Цены           — Услуга (slug), Бренд, Модель, Цена, Заметка
 *
 * Возвращает сводный отчёт по каждому листу.
 */
type SheetReport = { created: number; updated: number; skipped: number; errors: string[] };

function newReport(): SheetReport {
  return { created: 0, updated: 0, skipped: 0, errors: [] };
}

function readSheet(wb: XLSX.WorkBook, name: string): Record<string, any>[] | null {
  const sheet = wb.Sheets[name];
  if (!sheet) return null;
  return XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "" });
}

function trim(v: any) {
  return String(v ?? "").trim();
}

function boolRu(v: any): boolean {
  const s = trim(v).toLowerCase();
  return s === "да" || s === "true" || s === "1" || s === "yes" || s === "+";
}

function numOrNull(v: any): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function POST(req: NextRequest) {
  await requireAdmin();
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Файл не передан" }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const wb = XLSX.read(buf);

  const report: Record<string, SheetReport> = {};

  // ── Услуги ───────────────────────────────────────────────────────────
  const servicesRows = readSheet(wb, "Услуги");
  if (servicesRows) {
    const r = (report["Услуги"] = newReport());
    for (const [i, row] of servicesRows.entries()) {
      try {
        const slug = trim(row["slug"]) || trim(row["Slug"]);
        const name = trim(row["Название"]) || trim(row["Name"]);
        if (!slug || !name) { r.skipped++; continue; }
        const data = {
          name,
          kind: trim(row["kind"]) || "REPAIR",
          category: trim(row["Категория"]) || null,
          appliesTo: trim(row["Применима к"]).toLowerCase() || null,
          cartridgeBased: boolRu(row["По картриджу"]),
          priceNote: trim(row["Заметка о цене"]) || null,
          description: trim(row["Описание"]) || null,
          sortOrder: Number(row["Порядок"]) || 0,
          archived: boolRu(row["Архив"]),
        };
        const existing = await prisma.service.findUnique({ where: { slug } });
        if (existing) {
          await prisma.service.update({ where: { slug }, data });
          r.updated++;
        } else {
          await prisma.service.create({ data: { slug, ...data } });
          r.created++;
        }
      } catch (e: any) {
        r.errors.push(`Услуги, строка ${i + 2}: ${e.message}`);
      }
    }
  }

  // ── Картриджи ────────────────────────────────────────────────────────
  const cartridgesRows = readSheet(wb, "Картриджи");
  if (cartridgesRows) {
    const r = (report["Картриджи"] = newReport());
    for (const [i, row] of cartridgesRows.entries()) {
      try {
        const brand = trim(row["Бренд"]);
        const model = trim(row["Модель"]);
        if (!brand || !model) { r.skipped++; continue; }
        const chipRub = numOrNull(row["Цена чипа"]);
        const data = {
          // Нормализуем тип: принимаем русский и английский варианты,
          // на выходе всегда «лазерный»/«струйный» (канон в БД).
          type: (() => {
            const t = trim(row["Тип"]).toLowerCase();
            if (["струйный", "inkjet", "ink", "ink-jet"].includes(t)) return "струйный";
            return "лазерный";
          })(),
          isPopular: boolRu(row["Хит"]),
          isOriginal: boolRu(row["Оригинал"]),
          hasChip: boolRu(row["Чип"]),
          chipPrice: chipRub ? chipRub * 100 : null,
          pageYield: numOrNull(row["Ресурс, стр"]),
          compatible: trim(row["Совместимость"]) || null,
        };
        const existing = await prisma.cartridge.findUnique({
          where: { brand_model: { brand, model } },
        });
        if (existing) {
          await prisma.cartridge.update({
            where: { brand_model: { brand, model } },
            data,
          });
          r.updated++;
        } else {
          await prisma.cartridge.create({ data: { brand, model, ...data } });
          r.created++;
        }
      } catch (e: any) {
        r.errors.push(`Картриджи, строка ${i + 2}: ${e.message}`);
      }
    }
  }

  // ── Принтеры ─────────────────────────────────────────────────────────
  const printersRows = readSheet(wb, "Принтеры");
  if (printersRows) {
    const r = (report["Принтеры"] = newReport());
    for (const [i, row] of printersRows.entries()) {
      try {
        const brand = trim(row["Бренд"]);
        const family = trim(row["Семейство"]);
        if (!brand || !family) { r.skipped++; continue; }
        const aliasesStr = trim(row["Алиасы"]);
        const aliases = aliasesStr
          ? aliasesStr.split(/\s*\/\s*|,\s*/).filter(Boolean)
          : [family];
        const printType = (trim(row["Тип печати"]).toLowerCase() === "inkjet") ? "inkjet" : "laser";
        const data = {
          aliases: JSON.stringify(aliases),
          printType,
          kind: trim(row["Описание (kind)"]) || trim(row["kind"]) || null,
          segment: trim(row["Сегмент"]) || null,
          demand: trim(row["Спрос"]) || null,
          chipNote: trim(row["Заметка о чипе"]) || null,
        };
        const existing = await prisma.printerModel.findUnique({
          where: { brand_family: { brand, family } },
        });
        if (existing) {
          await prisma.printerModel.update({
            where: { brand_family: { brand, family } },
            data,
          });
          r.updated++;
        } else {
          await prisma.printerModel.create({ data: { brand, family, ...data } });
          r.created++;
        }
      } catch (e: any) {
        r.errors.push(`Принтеры, строка ${i + 2}: ${e.message}`);
      }
    }
  }

  // ── Совместимость ────────────────────────────────────────────────────
  const linksRows = readSheet(wb, "Совместимость");
  if (linksRows) {
    const r = (report["Совместимость"] = newReport());
    for (const [i, row] of linksRows.entries()) {
      try {
        const pBrand = trim(row["Принтер — Бренд"]);
        const pFamily = trim(row["Принтер — Семейство"]);
        const cBrand = trim(row["Картридж — Бренд"]);
        const cModel = trim(row["Картридж — Модель"]);
        if (!pBrand || !pFamily || !cBrand || !cModel) { r.skipped++; continue; }
        const printer = await prisma.printerModel.findUnique({
          where: { brand_family: { brand: pBrand, family: pFamily } },
        });
        const cartridge = await prisma.cartridge.findUnique({
          where: { brand_model: { brand: cBrand, model: cModel } },
        });
        if (!printer) {
          r.errors.push(`Совместимость, строка ${i + 2}: принтер "${pBrand} ${pFamily}" не найден`);
          continue;
        }
        if (!cartridge) {
          r.errors.push(`Совместимость, строка ${i + 2}: картридж "${cBrand} ${cModel}" не найден`);
          continue;
        }
        try {
          await prisma.printerCartridge.create({
            data: { printerModelId: printer.id, cartridgeId: cartridge.id },
          });
          r.created++;
        } catch {
          // связь уже существует — это OK
          r.skipped++;
        }
      } catch (e: any) {
        r.errors.push(`Совместимость, строка ${i + 2}: ${e.message}`);
      }
    }
  }

  // ── Цены ─────────────────────────────────────────────────────────────
  const pricesRows = readSheet(wb, "Цены") || readSheet(wb, "Прайс"); // обратная совместимость
  if (pricesRows) {
    const r = (report["Цены"] = newReport());
    for (const [i, row] of pricesRows.entries()) {
      try {
        const serviceKey = trim(row["Услуга"]).toLowerCase();
        const brand = trim(row["Бренд"]);
        const model = trim(row["Модель"]);
        const priceRub = Number(row["Цена"]);
        const note = trim(row["Заметка"]) || null;
        if (!serviceKey || !Number.isFinite(priceRub) || priceRub <= 0) { r.skipped++; continue; }

        const service = await prisma.service.findFirst({
          where: { OR: [{ slug: serviceKey }, { name: serviceKey }] },
        });
        if (!service) {
          r.errors.push(`Цены, строка ${i + 2}: услуга "${serviceKey}" не найдена`);
          continue;
        }

        let cartridgeId: string | null = null;
        if (brand && model) {
          const cart = await prisma.cartridge.upsert({
            where: { brand_model: { brand, model } },
            create: { brand, model, type: "лазерный" },
            update: {},
          });
          cartridgeId = cart.id;
        }

        const existing = await prisma.price.findFirst({
          where: { serviceId: service.id, cartridgeId },
        });
        if (existing) {
          await prisma.price.update({
            where: { id: existing.id },
            data: { amount: Math.round(priceRub * 100), note },
          });
          r.updated++;
        } else {
          await prisma.price.create({
            data: { serviceId: service.id, cartridgeId, amount: Math.round(priceRub * 100), note },
          });
          r.created++;
        }
      } catch (e: any) {
        r.errors.push(`Цены, строка ${i + 2}: ${e.message}`);
      }
    }
  }

  if (Object.keys(report).length === 0) {
    return NextResponse.json(
      { error: "В файле нет ни одного из ожидаемых листов: Услуги / Картриджи / Принтеры / Совместимость / Цены" },
      { status: 400 },
    );
  }

  // Сводка для UI: total {created, updated, skipped} + per-sheet
  const totals = Object.values(report).reduce(
    (acc, r) => ({
      created: acc.created + r.created,
      updated: acc.updated + r.updated,
      skipped: acc.skipped + r.skipped,
      errors: acc.errors + r.errors.length,
    }),
    { created: 0, updated: 0, skipped: 0, errors: 0 },
  );

  return NextResponse.json({ ...totals, sheets: report });
}
