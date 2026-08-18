import type { NextRequest } from "next/server";
import { pool } from "@/lib/db";

export const LOGIN_RATE_LIMIT_MAX = 5;
export const LOGIN_RATE_LIMIT_WINDOW_MS = 60_000;

const LOGIN_RATE_LIMIT_WINDOW_SECONDS = LOGIN_RATE_LIMIT_WINDOW_MS / 1000;

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

/**
 * Verifica si el IP está bloqueado por exceder los intentos de login.
 * Persistido en Postgres (tabla login_intento) para compartirse entre
 * instancias y sobrevivir reinicios.
 */
export async function isLoginRateLimited(ip: string): Promise<boolean> {
  const result = await pool.query<{ bloqueado_hasta: Date | null }>(
    `SELECT bloqueado_hasta FROM login_intento WHERE ip = $1`,
    [ip]
  );
  const bloqueadoHasta = result.rows[0]?.bloqueado_hasta;
  if (!bloqueadoHasta) return false;
  return new Date(bloqueadoHasta).getTime() > Date.now();
}

/**
 * Registra un intento fallido. La ventana se reinicia si pasó el tiempo del
 * bloqueo sin nuevos intentos; al alcanzar el máximo, el IP queda bloqueado
 * por LOGIN_RATE_LIMIT_WINDOW_MS.
 */
export async function recordFailedLogin(ip: string): Promise<void> {
  const result = await pool.query<{ intentos: number }>(
    `INSERT INTO login_intento (ip, intentos, bloqueado_hasta, ultimo_intento)
     VALUES ($1, 1, NULL, NOW())
     ON CONFLICT (ip) DO UPDATE SET
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
    [ip, LOGIN_RATE_LIMIT_WINDOW_SECONDS]
  );

  const intentos = result.rows[0]?.intentos ?? 0;
  if (intentos >= LOGIN_RATE_LIMIT_MAX) {
    await pool.query(
      `UPDATE login_intento
       SET bloqueado_hasta = NOW() + make_interval(secs => $2)
       WHERE ip = $1`,
      [ip, LOGIN_RATE_LIMIT_WINDOW_SECONDS]
    );
  }
}

export async function clearFailedLogins(ip: string): Promise<void> {
  await pool.query(`DELETE FROM login_intento WHERE ip = $1`, [ip]);
}

/** Borra todos los intentos registrados. Intended for tests / soporte. */
export async function resetLoginRateLimitStore(): Promise<void> {
  await pool.query(`TRUNCATE TABLE login_intento`);
}
