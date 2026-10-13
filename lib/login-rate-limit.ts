// lib/login-rate-limit.ts
//
// Bloqueo de intentos de login, compartido entre instancias vía Postgres
// (tabla login_intento) y persistente entre reinicios.
//
// La clave es polimórfica a propósito. El login escribe DOS claves por intento:
//
//   ip:<direccion>    → frena la fuerza bruta concentrada desde una IP
//   acct:<correo>     → frena el credential stuffing distribuido, que cambia
//                       de IP en cada intento para evadir el primero
//
// Antes solo existía la clave por IP, así que un atacante con muchas
// direcciones podía golpear una misma cuenta indefinidamente. Esto cubre
// OWASP ASVS V2.5.

import type { NextRequest } from "next/server";
import { pool } from "@/lib/db";
import { getLogger } from "@/lib/logger";

const log = getLogger("lib/login-rate-limit");

/** Ventana corta por IP: 5 intentos por minuto. */
export const LOGIN_RATE_LIMIT_MAX = 5;
export const LOGIN_RATE_LIMIT_WINDOW_MS = 60_000;

/** Ventana larga por cuenta: 5 intentos y luego 15 minutos de bloqueo.
 *  Deliberadamente más larga que la de IP porque el objetivo es cortar un
 *  ataque distribuido, no sólo frenar a alguien que se equivoca dos veces. */
export const ACCOUNT_LOCKOUT_MAX = 5;
export const ACCOUNT_LOCKOUT_WINDOW_MS = 15 * 60_000;

export function claveIp(ip: string): string {
  return `ip:${ip}`;
}

/** El correo se normaliza a minúsculas porque así es la clave de búsqueda en
 *  el login (`LOWER(correo) = LOWER($1)`): si no, `User@x.com` y
 *  `user@x.com` cuentan como cuentas distintas y el bloqueo se evadiría
 *  cambiando mayúsculas. */
export function claveCuenta(correo: string): string {
  return `acct:${correo.trim().toLowerCase()}`;
}

export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  return "unknown";
}

async function estaBloqueada(clave: string): Promise<boolean> {
  const result = await pool.query<{ bloqueado_hasta: Date | null }>(
    `SELECT bloqueado_hasta FROM login_intento WHERE clave = $1`,
    [clave]
  );
  const bloqueadoHasta = result.rows[0]?.bloqueado_hasta;
  if (!bloqueadoHasta) return false;
  return new Date(bloqueadoHasta).getTime() > Date.now();
}

/** Verifica si la clave está bloqueada por exceder los intentos permitidos. */
export async function isLoginRateLimited(clave: string): Promise<boolean> {
  return estaBloqueada(clave);
}

/**
 * Registra un intento fallido para una clave.
 *
 * Devuelve `true` SOLO en el intento en que la clave pasa de desbloqueada a
 * bloqueada. Sirve para no repetir el correo de aviso en cada intento
 * posterior (si no, un atacante que ya sabe la contraseña podría usar el
 * bloqueo como arma de spam contra la bandeja de la víctima).
 */
export async function recordFailedLogin(
  clave: string,
  maxIntentos: number = LOGIN_RATE_LIMIT_MAX,
  windowMs: number = LOGIN_RATE_LIMIT_WINDOW_MS
): Promise<boolean> {
  const ventanaSegundos = windowMs / 1000;
  const yaEstabaBloqueada = await estaBloqueada(clave);

  const result = await pool.query<{ intentos: number }>(
    `INSERT INTO login_intento (clave, intentos, bloqueado_hasta, ultimo_intento)
     VALUES ($1, 1, NULL, NOW())
     ON CONFLICT (clave) DO UPDATE SET
       intentos = CASE
         WHEN login_intento.ultimo_intento <= NOW() - make_interval(secs => $2)
           THEN 1
         ELSE login_intento.intentos + 1
       END,
       ultimo_intento = NOW(),
       bloqueado_hasta = CASE
         WHEN login_intento.bloqueado_hasta IS NOT NULL
          AND login_intento.bloqueado_hasta > NOW()
           THEN login_intento.bloqueado_hasta
         ELSE NULL
       END
     RETURNING intentos`,
    [clave, ventanaSegundos]
  );

  const intentos = result.rows[0]?.intentos ?? 0;
  if (intentos < maxIntentos) return false;

  await pool.query(
    `UPDATE login_intento
        SET bloqueado_hasta = NOW() + make_interval(secs => $2)
      WHERE clave = $1`,
    [clave, ventanaSegundos]
  );

  const ahoraBloqueada = await estaBloqueada(clave);
  const nuevoBloqueo = !yaEstabaBloqueada && ahoraBloqueada;

  if (nuevoBloqueo) {
    log.warn(
      { clave, intentos, ventanaMin: windowMs / 60000 },
      "Clave bloqueada por intentos fallidos"
    );
  }

  return nuevoBloqueo;
}

export async function clearFailedLogins(clave: string): Promise<void> {
  await pool.query(`DELETE FROM login_intento WHERE clave = $1`, [clave]);
}

/** Borra todos los intentos registrados. Intended for tests / soporte. */
export async function resetLoginRateLimitStore(): Promise<void> {
  await pool.query(`TRUNCATE TABLE login_intento`);
}