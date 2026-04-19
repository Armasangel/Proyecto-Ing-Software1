import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE } from "./lib/auth";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/inventario",
  "/productos",
  "/ventas",
  "/reportes",
  "/tienda",
  "/mayoreo",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const needsAuth = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
  if (!needsAuth) return NextResponse.next();

  const hasToken = !!request.cookies.get(AUTH_COOKIE)?.value;
  if (!hasToken) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/inventario/:path*",
    "/productos/:path*",
    "/ventas/:path*",
    "/reportes/:path*",
    "/tienda/:path*",
    "/mayoreo/:path*",
  ],
};
