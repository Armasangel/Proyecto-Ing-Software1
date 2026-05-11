/** Paginación del historial de ventas (dueño). Reutilizable al añadir filtros en query string. */

export const HISTORIAL_VENTAS_DEFAULT_LIMIT = 50;
export const HISTORIAL_VENTAS_MAX_LIMIT = 200;

export type HistorialVentasPaginationParsed = {
  /** Límite efectivo por página (acotado a MAX). */
  limit: number;
  offset: number;
  /** Límite a usar en SQL: limit + 1 para detectar si hay página siguiente. */
  fetchLimit: number;
};

/**
 * Lee `limit` y `offset` de la query. `limit` por defecto DEFAULT; máximo MAX (valores mayores se recortan).
 */
export function parseHistorialPagination(
  searchParams: URLSearchParams
): HistorialVentasPaginationParsed {
  let limit = HISTORIAL_VENTAS_DEFAULT_LIMIT;
  const rawLimit = searchParams.get("limit");
  if (rawLimit !== null && rawLimit !== "") {
    const n = Number.parseInt(rawLimit, 10);
    if (Number.isFinite(n) && n > 0) {
      limit = Math.min(n, HISTORIAL_VENTAS_MAX_LIMIT);
    }
  }

  let offset = 0;
  const rawOffset = searchParams.get("offset");
  if (rawOffset !== null && rawOffset !== "") {
    const n = Number.parseInt(rawOffset, 10);
    if (Number.isFinite(n) && n >= 0) {
      offset = n;
    }
  }

  return {
    limit,
    offset,
    fetchLimit: limit + 1,
  };
}

export type HistorialVentasPaginationMeta = {
  limit: number;
  offset: number;
  hasMore: boolean;
  /** Offset a usar en la siguiente petición; null si no hay más filas. */
  nextOffset: number | null;
  /** Tope permitido para `limit` en una sola petición. */
  maxLimit: number;
};

export function buildHistorialPaginationMeta(
  limit: number,
  offset: number,
  hasMore: boolean,
  returnedCount: number
): HistorialVentasPaginationMeta {
  return {
    limit,
    offset,
    hasMore,
    nextOffset: hasMore ? offset + returnedCount : null,
    maxLimit: HISTORIAL_VENTAS_MAX_LIMIT,
  };
}
