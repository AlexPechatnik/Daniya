import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();
  const user = await prisma.user.findUnique({ where: { email: String(email).toLowerCase() } });
  if (!user || !user.active) return NextResponse.json({ error: "Пользователь не найден" }, { status: 401 });
  const ok = await bcrypt.compare(String(password), user.password);
  if (!ok) return NextResponse.json({ error: "Неверный пароль" }, { status: 401 });
  const session = await getSession();
  session.userId = user.id;
  await session.save();
  return NextResponse.json({ ok: true });
}
