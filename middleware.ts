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
  "/facturacion",
  "/precios",
];

// ─── Verificación JWT compatible con Edge Runtime ─────────────────────────────
// No podemos usar jsonwebtoken aquí porque depende de módulos Node.js
// que no están disponibles en el Edge Runtime de Next.js.
// Usamos la Web Crypto API que sí está disponible en Edge.

function base64UrlDecode(str: string): Uint8Array {
  // Convierte base64url → base64 estándar → bytes
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

async function verifyJwtEdge(token: string, secret: string): Promise<boolean> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return false;

    const [headerB64, payloadB64, signatureB64] = parts;

    // Importar la clave secreta para HMAC-SHA256
    const keyData = new TextEncoder().encode(secret);
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    // Verificar la firma
    const signature = base64UrlDecode(signatureB64);
    const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
    const valid = await crypto.subtle.verify("HMAC", cryptoKey, signature, data);
    if (!valid) return false;

    // Verificar expiración del token
    const payload = JSON.parse(
      new TextDecoder().decode(base64UrlDecode(payloadB64))
    );
    if (payload.exp && Date.now() / 1000 > payload.exp) return false;

    return true;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const needsAuth = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
  if (!needsAuth) return NextResponse.next();

  const token = request.cookies.get(AUTH_COOKIE)?.value;

  // FIX: antes solo verificaba que la cookie existiera (!!token).
  // Un token expirado o malformado pasaba igual, causando flash de "Cargando…"
  // antes de que el hook del cliente lo detectara y redirigiera.
  // Ahora verificamos firma + expiración directamente en el middleware.
  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const secret =
    process.env.JWT_SECRET ??
    (process.env.NODE_ENV === "development"
      ? "deposito_san_miguel_secret_key_dev"
      : null);

  if (!secret) {
    // Sin secret configurado en producción: bloquear por seguridad
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const valid = await verifyJwtEdge(token, secret);
  if (!valid) {
    // Token inválido o expirado: limpiar cookie y redirigir
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.set(AUTH_COOKIE, "", { path: "/", maxAge: 0 });
    return response;
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
    "/facturacion/:path*",
    "/precios/:path*",
  ],
};