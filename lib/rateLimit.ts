// Limitador de tasa simple en memoria, por clave (ej. "facturacion:<ip>" o "facturacion:<userId>")
// Sirve para un solo proceso/instancia. Si en algún momento despliegan con varias instancias,
// esto habría que moverlo a Redis (ej. Upstash) para que el contador sea compartido.

type Entry = { count: number; resetAt: number };
const store = new Map<string, Entry>();

export function rateLimit(key: string, limit = 10, windowMs = 60_000) {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, retryAfter: entry.resetAt - now };
  }

  entry.count++;
  return { allowed: true, remaining: limit - entry.count, resetAt: entry.resetAt };
}

// Utilidad para obtener un identificador de cliente a partir del Request
export function getClientKey(req: Request, prefix: string) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous";
  return `${prefix}:${ip}`;
}