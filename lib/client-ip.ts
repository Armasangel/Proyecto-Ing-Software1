// lib/client-ip.ts
//
// Fuente ÚNICA de la IP del cliente. Antes había varias copias de getClientIp
// (en login-rate-limit, api-rate-limit y rateLimit) que tomaban el PRIMER valor
// de `x-forwarded-for`. Ese primer valor lo pone el cliente y es falsificable:
// cualquiera puede mandar `X-Forwarded-For: 1.2.3.4` para evadir el rate limit
// por IP o ensuciar la auditoría.
//
// Aquí se toma el último salto de confianza: el valor que agrega nuestro propio
// proxy. `x-forwarded-for` se arma como `cliente, proxy1, ..., proxyN`, donde las
// entradas de la DERECHA las ponen los proxies que controlamos y no se pueden
// falsificar; las de la izquierda son las que el cliente afirma y no son de fiar.
//
// TRUSTED_PROXY_COUNT = cuántos proxies de confianza hay delante de la app
// (por defecto 1). La IP real del cliente es la que está esa cantidad de saltos
// desde la derecha del `x-forwarded-for`.

type ConHeaders = { headers: { get(name: string): string | null } };

const TRUSTED_PROXY_COUNT = Math.max(
  1,
  Number.parseInt(process.env.TRUSTED_PROXY_COUNT ?? "1", 10) || 1
);

export function getClientIp(req: ConHeaders): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const partes = forwarded
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);

    if (partes.length > 0) {
      // Contar TRUSTED_PROXY_COUNT saltos desde la derecha. Con 1 proxy de
      // confianza, es la última entrada (la que vio nuestro proxy). Se recorta
      // al rango válido para no salirnos del arreglo.
      const idx = Math.min(
        partes.length - 1,
        Math.max(0, partes.length - TRUSTED_PROXY_COUNT)
      );
      const ip = partes[idx];
      if (ip) return ip;
    }
  }

  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  return "unknown";
}
