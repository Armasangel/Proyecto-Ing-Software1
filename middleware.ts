// middleware.ts
//
// Corre en el RUNTIME DE NODE.JS (config.runtime = "nodejs", estable desde
// Next.js 15.5).
//
// Además de la autenticación, este middleware loggea la ENTRADA de cada request HTTP (método, path, IP,
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
import { esSesionValida } from "@/lib/sesion";
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
  "/mi-cuenta",
];

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

/**
 * Se usa para las rutas de API: en vez de devolver un 401 propio (lo que
 * obligaría a cada handler a conocer las reglas de revocación), se reescribe
 * el request como si el cliente no tuviera cookie. Así `getUsuarioFromRequest`
 * devuelve null y cada ruta conserva exactamente su respuesta habitual.
 */
function requestSinCookieAuth(request: NextRequest): Headers {
  const headers = new Headers(request.headers);
  const raw = headers.get("cookie");
  if (raw) {
    const limpio = raw
      .split(";")
      .map((parte) => parte.trim())
      .filter((parte) => parte && !parte.startsWith(`${AUTH_COOKIE}=`))
      .join("; ");
    if (limpio) headers.set("cookie", limpio);
    else headers.delete("cookie");
  }
  return headers;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // No saturar los logs con los health checks recurrentes.
  if (pathname === "/api/health" || pathname.startsWith("/api/health/")) {
    return NextResponse.next();
  }

  const ip = getClientIp(request);
  const method = request.method;

  // Retirar informacion delicada del searchParam
  const queryParams = new URLSearchParams(request.nextUrl.search);
  const safeQuery = {
    page: queryParams.get('page'),
    sort: queryParams.get('sort'),
  };

 // Log de entrada de CADA request (páginas y API).
  const logData = {
    method,
    path: pathname,
    ip,
    query: Object.values(safeQuery).some((value) => value !== null) ? safeQuery : undefined,
  };
  log.info(logData, `request ${method} ${pathname}`);

  const needsAuth = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );

  const esApi = pathname === "/api" || pathname.startsWith("/api/");

  if (!needsAuth && !esApi) return NextResponse.next();

  const token = request.cookies.get(AUTH_COOKIE)?.value;
  if (!token) {
    if (needsAuth) {
      log.warn({ path: pathname, ip }, "Acceso a ruta protegida sin sesión");
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.next();
  }

  // Verifica JWT (firma + expiración). `verifyAuthToken` falla cerrado
  // (devuelve null) si falta el secreto o es débil, o si el token es inválido.
  const usuario = verifyAuthToken(token);
  if (!usuario) {
    log.warn({ path: pathname, ip }, "Token inválido o expirado en ruta protegida");
    if (!esApi) {
      const response = NextResponse.redirect(new URL("/login", request.url));
      response.cookies.set(AUTH_COOKIE, "", { path: "/", maxAge: 0 });
      return response;
    }
    return NextResponse.next({ request: { headers: requestSinCookieAuth(request) } });
  }

  const sesionVigente = await esSesionValida(usuario.id_usuario, usuario.sesion_version);

  if (!sesionVigente) {
    log.warn(
      { path: pathname, ip, id_usuario: usuario.id_usuario },
      "Sesión revocada: versión obsoleta o usuario deshabilitado"
    );

    if (!esApi) {
      const response = NextResponse.redirect(new URL("/login", request.url));
      response.cookies.set(AUTH_COOKIE, "", { path: "/", maxAge: 0 });
      return response;
    }

    // En API no se manda Set-Cookie: el handler de login escribe su propia
    // cookie y un borrado desde acá competiría con ella.
    return NextResponse.next({ request: { headers: requestSinCookieAuth(request) } });
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
    "/mi-cuenta",
    "/mi-cuenta/:path*",
    "/api",
    "/api/:path*",
  ],
};
