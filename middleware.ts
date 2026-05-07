// middleware.ts

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE } from "./lib/auth";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/inventario",
  "/gestion-inventario",
  "/bodegas",
  "/productos",
  "/ventas",
  "/reportes",
  "/tienda",
  "/mayoreo",
];

/** Decodifica base64url a ArrayBuffer (compatible con Edge Runtime). */
function base64urlToBuffer(b64url: string): ArrayBuffer {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

/**
 * Verifica un JWT HS256 usando Web Crypto API (Edge-compatible).
 * Devuelve el payload si la firma es válida y el token no expiró;
 * lanza un error en caso contrario.
 */
async function verifyJwtEdge(token: string, secret: string): Promise<Record<string, unknown>> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("JWT malformado");

  const [headerB64, payloadB64, sigB64] = parts;

  // Importar la clave
  const keyMaterial = new TextEncoder().encode(secret);
  const key = await crypto.subtle.importKey(
    "raw",
    keyMaterial,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );

  // Verificar firma
  const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const sig = base64urlToBuffer(sigB64);
  const valid = await crypto.subtle.verify("HMAC", key, sig, data);
  if (!valid) throw new Error("Firma inválida");

  // Decodificar payload
  const payload = JSON.parse(atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/"))) as Record<string, unknown>;

  // Verificar expiración
  if (typeof payload.exp === "number" && payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error("Token expirado");
  }

  return payload;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const needsAuth = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
  if (!needsAuth) return NextResponse.next();

  const token = request.cookies.get(AUTH_COOKIE)?.value;

  // Sin cookie → redirigir a login
  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Verificar JWT (firma + expiración)
  const secret =
    process.env.JWT_SECRET ||
    (process.env.NODE_ENV === "development"
      ? "deposito_san_miguel_secret_key_dev"
      : null);

  if (!secret) {
    // En producción sin secret configurado, bloquear por seguridad
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    await verifyJwtEdge(token, secret);
    return NextResponse.next();
  } catch {
    // Token inválido o expirado: limpiar cookie y redirigir
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.set(AUTH_COOKIE, "", { path: "/", maxAge: 0 });
    return response;
  }
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/inventario/:path*",
    "/gestion-inventario/:path*",
    "/bodegas/:path*",
    "/productos/:path*",
    "/ventas/:path*",
    "/reportes/:path*",
    "/tienda/:path*",
    "/mayoreo/:path*",
  ],
};