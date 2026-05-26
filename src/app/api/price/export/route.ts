import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

/**
 * GET /api/price/export — выгрузка прайса в многоlистовый xlsx.
 * Это «единый файл управления»: админ скачивает, правит в Excel, загружает обратно
 * через /api/price/import. Все листы зеркалят соответствующие таблицы в БД.
 *
 *   Услуги         — каталог и метаданные (категория, applies_to, базовая цена, заметка)
 *   Картриджи      — каталог расходников (только лазерные)
 *   Принтеры       — каталог моделей с типом печати (laser/inkjet)
 *   Совместимость  — связь принтер ↔ картридж (M:N)
 *   Цены           — цены услуг (per cartridge + базовая ставка)
 */
export async function GET() {
  await requireAdmin();

  const [services, cartridges, printers, links, prices] = await Promise.all([
    prisma.service.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.cartridge.findMany({ orderBy: [{ brand: "asc" }, { model: "asc" }] }),
    prisma.printerModel.findMany({ orderBy: [{ brand: "asc" }, { family: "asc" }] }),
    prisma.printerCartridge.findMany({
      include: { printerModel: true, cartridge: true },
      orderBy: { printerModel: { brand: "asc" } },
    }),
    prisma.price.findMany({
      include: { service: true, cartridge: true },
      orderBy: [{ service: { sortOrder: "asc" } }, { cartridge: { brand: "asc" } }, { cartridge: { model: "asc" } }],
    }),
  ]);

  const wb = XLSX.utils.book_new();

  // ── Услуги ───────────────────────────────────────────────────────────
  const servicesRows = services.map((s) => ({
    "slug": s.slug,
    "Название": s.name,
    "Категория": s.category || "",
    "Применима к": s.appliesTo || "both",
    "По картриджу": s.cartridgeBased ? "да" : "",
    "Заметка о цене": s.priceNote || "",
    "Описание": s.description || "",
    "Порядок": s.sortOrder,
    "Архив": s.archived ? "да" : "",
    "kind": s.kind, // для информации, не редактируется
  }));
  addSheet(wb, "Услуги", servicesRows, [
    "slug", "Название", "Категория", "Применима к", "По картриджу",
    "Заметка о цене", "Описание", "Порядок", "Архив", "kind",
  ]);

  // ── Картриджи ────────────────────────────────────────────────────────
  const cartridgesRows = cartridges.map((c) => ({
    "Бренд": c.brand,
    "Модель": c.model,
    "Тип": c.type,
    "Хит": c.isPopular ? "да" : "",
    "Оригинал": c.isOriginal ? "да" : "",
    "Чип": c.hasChip ? "да" : "",
    "Цена чипа": c.chipPrice ? Math.round(c.chipPrice / 100) : "",
    "Ресурс, стр": c.pageYield || "",
    "Совместимость": c.compatible || "",
  }));
  addSheet(wb, "Картриджи", cartridgesRows, [
    "Бренд", "Модель", "Тип", "Хит", "Оригинал", "Чип", "Цена чипа", "Ресурс, стр", "Совместимость",
  ]);

  // ── Принтеры ────────────────────────────────────────────────────────
  const printersRows = printers.map((p) => {
    let aliases: string[] = [];
    try { aliases = JSON.parse(p.aliases); } catch {}
    return {
      "Бренд": p.brand,
      "Семейство": p.family,
      "Тип печати": p.printType, // laser | inkjet
      "Алиасы": aliases.join(" / "),
      "Описание (kind)": p.kind || "",
      "Сегмент": p.segment || "",
      "Спрос": p.demand || "",
      "Заметка о чипе": p.chipNote || "",
    };
  });
  addSheet(wb, "Принтеры", printersRows, [
    "Бренд", "Семейство", "Тип печати", "Алиасы", "Описание (kind)", "Сегмент", "Спрос", "Заметка о чипе",
  ]);

  // ── Совместимость ────────────────────────────────────────────────────
  const linksRows = links.map((l) => ({
    "Принтер — Бренд": l.printerModel.brand,
    "Принтер — Семейство": l.printerModel.family,
    "Картридж — Бренд": l.cartridge.brand,
    "Картридж — Модель": l.cartridge.model,
  }));
  addSheet(wb, "Совместимость", linksRows, [
    "Принтер — Бренд", "Принтер — Семейство", "Картридж — Бренд", "Картридж — Модель",
  ]);

  // ── Цены ─────────────────────────────────────────────────────────────
  const pricesRows = prices.map((p) => ({
    "Услуга": p.service.slug,
    "Бренд": p.cartridge?.brand || "",
    "Модель": p.cartridge?.model || "",
    "Цена": Math.round(p.amount / 100),
    "Заметка": p.note || "",
  }));
  addSheet(wb, "Цены", pricesRows, ["Услуга", "Бренд", "Модель", "Цена", "Заметка"]);

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const today = new Date().toISOString().slice(0, 10);

  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="price-${today}.xlsx"`,
    },
  });
}

function addSheet(wb: XLSX.WorkBook, name: string, rows: Record<string, any>[], headers: string[]) {
  const ws = XLSX.utils.json_to_sheet(rows, { header: headers });
  ws["!cols"] = headers.map((key) => ({
    wch: Math.max(key.length, ...rows.map((r) => String(r[key] ?? "").length)) + 2,
  }));
  XLSX.utils.book_append_sheet(wb, ws, name);
}
