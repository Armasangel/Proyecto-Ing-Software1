// middleware.ts
//
// Corre en el RUNTIME DE NODE.JS (config.runtime = "nodejs", estable desde
// Next.js 15.5). A diferencia del Edge runtime, acá se puede importar
// jsonwebtoken, la pool? no — SOLO utilidades ligeras y el logger pino.
//
// Además de la autenticación (que antes usaba Web Crypto para Edge), este
// middleware loggea la ENTRADA de cada request HTTP (método, path, IP,
// usuario) con pino. El matcher incluye `/api/:path*` para que el logging
// también cubra las rutas de API.
//
// Limitación conocida: el middleware no puede observar el status HTTP final
// de los requests que pasan de largo (NextResponse.next()). Por eso el log
// es de entrada; los desenlaces (errores, eventos de negocio) se capturan en
// los handlers con apiError + logs INFO/WARN (ver lib/logger.ts).

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE, verifyAuthToken } from "@/lib/auth";
import { getLogger } from "@/lib/logger";

const log = getLogger("middleware");

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/inventario",
  "/gestion-inventario",
  "/bodegas",
  "/bodega",
  "/productos",
  "/ventas",
  "/ordenes",
  "/historial-ventas",
  "/reportes",
  "/usuarios",
  "/deudas",
  "/facturacion",
  "/catalogo",
  "/proveedores",
];

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // No saturar los logs con los health checks recurrentes.
  if (pathname === "/api/health" || pathname.startsWith("/api/health/")) {
    return NextResponse.next();
  }

  const ip = getClientIp(request);
  const method = request.method;

  // Log de entrada de CADA request (páginas y API).
  log.info({
    method,
    path: pathname,
    ip,
    query: request.nextUrl.search || undefined,
  }, `request ${method} ${pathname}`);

  const needsAuth = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
  if (!needsAuth) return NextResponse.next();

  const token = request.cookies.get(AUTH_COOKIE)?.value;

  // Sin cookie → redirigir a login
  if (!token) {
    log.warn({ path: pathname, ip }, "Acceso a ruta protegida sin sesión");
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Verifica JWT (firma + expiración). `verifyAuthToken` falla cerrado
  // (devuelve null) si falta el secreto o es débil, o si el token es inválido.
  const usuario = verifyAuthToken(token);
  if (!usuario) {
    log.warn({ path: pathname, ip }, "Token inválido o expirado en ruta protegida");
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.set(AUTH_COOKIE, "", { path: "/", maxAge: 0 });
    return response;
  }

  log.debug(
    { id_usuario: usuario.id_usuario, tipo_usuario: usuario.tipo_usuario, path: pathname },
    "Request autenticado"
  );

  return NextResponse.next();
}

export const config = {
  runtime: "nodejs",
  matcher: [
    "/dashboard/:path*",
    "/inventario/:path*",
    "/gestion-inventario/:path*",
    "/bodegas/:path*",
    "/bodega",
    "/bodega/:path*",
    "/productos/:path*",
    "/ventas/:path*",
    "/ordenes/:path*",
    "/historial-ventas",
    "/historial-ventas/:path*",
    "/reportes/:path*",
    "/usuarios",
    "/usuarios/:path*",
    "/deudas",
    "/deudas/:path*",
    "/facturacion",
    "/facturacion/:path*",
    "/catalogo",
    "/catalogo/:path*",
    "/proveedores",
    "/proveedores/:path*",
    "/api",
    "/api/:path*",
  ],
};