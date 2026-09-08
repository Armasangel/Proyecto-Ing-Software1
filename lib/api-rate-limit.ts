import { pool } from "@/lib/db";

export type RateLimitResult = {
  limited: boolean;
  /** Segundos que faltan para que se libere la ventana actual. */
  retryAfterSeconds: number;
  /** Solicitudes restantes en la ventana actual (0 si ya se excedió). */
  restantes: number;
};

/**
 * Rate limiter de ventana fija, de propósito general, este
 * cuenta *cualquier* solicitud contra una clave arbitraria, así que sirve
 * para proteger cualquier endpoint (usuarios, o los que se agreguen luego).
 *
 * @param clave      Identificador único del límite, ej. `usuarios:POST:${ip}`.
 * @param max        Máximo de solicitudes permitidas dentro de la ventana.
 * @param windowMs   Duración de la ventana en milisegundos.
 */
export async function checkRateLimit(
  clave: string,
  max: number,
  windowMs: number
): Promise<RateLimitResult> {
  const windowSeconds = windowMs / 1000;

  const result = await pool.query<{ contador: number; ventana_inicio: Date }>(
    `INSERT INTO api_rate_limit (clave, contador, ventana_inicio)
     VALUES ($1, 1, NOW())
     ON CONFLICT (clave) DO UPDATE SET
       contador = CASE
         WHEN api_rate_limit.ventana_inicio <= NOW() - make_interval(secs => $2)
           THEN 1
         ELSE api_rate_limit.contador + 1
       END,
       ventana_inicio = CASE
         WHEN api_rate_limit.ventana_inicio <= NOW() - make_interval(secs => $2)
           THEN NOW()
         ELSE api_rate_limit.ventana_inicio
       END
     RETURNING contador, ventana_inicio`,
    [clave, windowSeconds]
  );

  const { contador, ventana_inicio } = result.rows[0];
  const limited = contador > max;
  const transcurridoMs = Date.now() - new Date(ventana_inicio).getTime();
  const retryAfterSeconds = Math.max(0, Math.ceil((windowMs - transcurridoMs) / 1000));

  return {
    limited,
    retryAfterSeconds,
    restantes: Math.max(0, max - contador),
  };
}

export function getClientIp(req: { headers: { get(name: string): string | null } }): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "unknown";
}
