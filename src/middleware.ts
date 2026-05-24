import { NextResponse, type NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/crm") && pathname !== "/crm/login") {
    const cookie = req.cookies.get("ps_session");
    if (!cookie) {
      const baseUrl = process.env.PUBLIC_BASE_URL || req.nextUrl.origin;
      return NextResponse.redirect(new URL("/crm/login", baseUrl));
    }
  }
  return NextResponse.next();
}

export const config = { matcher: ["/crm/:path*"] };
