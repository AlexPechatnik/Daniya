import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

/**
 * GET /api/price/export — выгрузка прайса в xlsx в том же формате, что ожидает /api/price/import.
 * Колонки: [Услуга, Бренд, Модель, Цена, Заметка].
 *
 * Идея: админ скачал → поправил в Excel → загрузил обратно → цены обновились.
 */
export async function GET() {
  await requireAdmin();

  const prices = await prisma.price.findMany({
    include: { service: true, cartridge: true },
    orderBy: [
      { service: { name: "asc" } },
      { cartridge: { brand: "asc" } },
      { cartridge: { model: "asc" } },
    ],
  });

  const rows = prices.map((p) => ({
    "Услуга": p.service.slug,
    "Бренд": p.cartridge?.brand || "",
    "Модель": p.cartridge?.model || "",
    "Цена": Math.round(p.amount / 100),
    "Заметка": p.note || "",
  }));

  const ws = XLSX.utils.json_to_sheet(rows, {
    header: ["Услуга", "Бренд", "Модель", "Цена", "Заметка"],
  });
  // Авто-ширина колонок по самой длинной строке.
  const colWidths = ["Услуга", "Бренд", "Модель", "Цена", "Заметка"].map((key) => ({
    wch: Math.max(key.length, ...rows.map((r) => String((r as any)[key] || "").length)) + 2,
  }));
  ws["!cols"] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Прайс");

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
