import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "./db";

export type SessionData = { userId?: string };

const sessionOptions: SessionOptions = {
  password: process.env.SESSION_PASSWORD || "dev-only-password-please-change-me-32+chars",
  cookieName: "ps_session",
  cookieOptions: { secure: process.env.NODE_ENV === "production", sameSite: "lax" },
};

export async function getSession() {
  return getIronSession<SessionData>(await cookies(), sessionOptions);
}

export async function getCurrentUser() {
  const session = await getSession();
  if (!session.userId) return null;
  return prisma.user.findUnique({ where: { id: session.userId } });
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/crm/login");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/crm");
  return user;
}
