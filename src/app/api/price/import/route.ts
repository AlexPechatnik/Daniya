import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

/**
 * Импорт прайса из Excel.
 * Формат: колонки [Услуга, Бренд, Модель, Цена, Заметка?]
 *   - "Услуга" — slug услуги (zapravka / zamena / diagnostika / remont) или название
 *   - "Бренд" + "Модель" — картридж (можно пусто для базовой цены)
 *   - "Цена" — рубли, число
 *
 * Загрузка POST multipart/form-data, поле "file".
 */
export async function POST(req: NextRequest) {
  await requireAdmin();
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Файл не передан" }, { status: 400 });

  const buf = Buffer.from(await file.arrayBuffer());
  const wb = XLSX.read(buf);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "" });

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const [i, row] of rows.entries()) {
    try {
      const serviceKey = String(row["Услуга"] || row["Service"] || "").trim().toLowerCase();
      const brand = String(row["Бренд"] || row["Brand"] || "").trim();
      const model = String(row["Модель"] || row["Model"] || "").trim();
      const priceRub = Number(row["Цена"] || row["Price"] || 0);
      const note = String(row["Заметка"] || row["Note"] || "").trim() || null;

      if (!serviceKey || !priceRub) { skipped++; continue; }

      const service = await prisma.service.findFirst({
        where: { OR: [{ slug: serviceKey }, { name: { equals: serviceKey } }] },
      });
      if (!service) { errors.push(`Строка ${i + 2}: услуга "${serviceKey}" не найдена`); continue; }

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
        await prisma.price.update({ where: { id: existing.id }, data: { amount: priceRub * 100, note } });
        updated++;
      } else {
        await prisma.price.create({ data: { serviceId: service.id, cartridgeId, amount: priceRub * 100, note } });
        created++;
      }
    } catch (e: any) {
      errors.push(`Строка ${i + 2}: ${e.message}`);
    }
  }

  return NextResponse.json({ created, updated, skipped, errors });
}
