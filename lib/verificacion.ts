// lib/verificacion.ts
//
// Helpers para la verificación en 2 pasos por correo:
// - Genera el código de 6 dígitos.
// - Lo guarda hasheado (igual que la contraseña — nunca en texto plano).
// - Firma/valida un "pre-token" de corta duración que identifica al usuario
//   que ya pasó usuario+contraseña pero todavía no metió el código.

import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { getJwtSecret } from "@/lib/auth";

const CODIGO_EXPIRA_MIN = 5;
const PRE_TOKEN_EXPIRA = "5m";
const MAX_INTENTOS = 5;

export function generarCodigo(): string {
  // 6 dígitos, con ceros a la izquierda si hace falta (ej. "004821").
  const n = crypto.randomInt(0, 1_000_000);
  return String(n).padStart(6, "0");
}

export function hashCodigo(codigo: string): string {
  return bcrypt.hashSync(codigo, 10);
}

export function compararCodigo(codigo: string, hash: string): boolean {
  try {
    return bcrypt.compareSync(codigo, hash);
  } catch {
    return false;
  }
}

export function minutosDeExpiracion(): number {
  return CODIGO_EXPIRA_MIN;
}

export function fechaExpiracion(): Date {
  return new Date(Date.now() + CODIGO_EXPIRA_MIN * 60 * 1000);
}

export function getMaxIntentos(): number {
  return MAX_INTENTOS;
}

// Pre-token: prueba de que este cliente ya pasó el paso 1 (usuario + contraseña)
// para el id_usuario indicado. Vida corta (5 min) y un "purpose" propio para
// que no se pueda confundir ni reusar como si fuera el AUTH_COOKIE real.
export function signPreToken(id_usuario: number): string {
  return jwt.sign({ purpose: "2fa_pendiente" }, getJwtSecret(), {
    subject: String(id_usuario),
    expiresIn: PRE_TOKEN_EXPIRA,
  });
}

export function verifyPreToken(token: string): number | null {
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as jwt.JwtPayload & { purpose?: string };
    if (decoded.purpose !== "2fa_pendiente") return null;
    const id = decoded.sub;
    if (typeof id !== "string" || !id) return null;
    return Number(id);
  } catch {
    return null;
  }
}

// Muestra el correo parcialmente oculto en el paso 2, ej. "ma***@tienda.com",
// para confirmarle al usuario a dónde llegó el código sin exponerlo entero.
export function enmascararCorreo(correo: string): string {
  const [usuario, dominio] = correo.split("@");
  if (!dominio) return correo;
  const visible = usuario.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(usuario.length - 2, 1))}@${dominio}`;
}