import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes: login page, auth API, and Blob upload webhook callback
  if (
    pathname === "/" ||
    pathname.startsWith("/api/auth") ||
    pathname === "/api/pdfs/upload"
  ) {
    return NextResponse.next();
  }

  const session = request.cookies.get("t4p_session");
  const expected = process.env.SESSION_TOKEN;

  if (!expected || session?.value !== expected) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
