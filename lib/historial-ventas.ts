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

/** Intervalos fijos (solo claves permitidas; seguro para interpolar en SQL). */
const PERIODO_INTERVAL: Record<string, string> = {
  day: "1 day",
  week: "7 days",
  month: "30 days",
  year: "365 days",
};

export function historialVentasPeriodosValidos(): string[] {
  return Object.keys(PERIODO_INTERVAL);
}

/**
 * Valida query params del historial. Devuelve mensaje de error o null si OK.
 */
export function validateHistorialQueryParams(
  sp: URLSearchParams
): string | null {
  const rawMin = sp.get("min_total");
  const rawMax = sp.get("max_total");
  let min: number | null = null;
  let max: number | null = null;
  if (rawMin !== null && rawMin !== "") {
    const n = Number(rawMin);
    if (!Number.isFinite(n) || n < 0) return "min_total inválido";
    min = n;
  }
  if (rawMax !== null && rawMax !== "") {
    const n = Number(rawMax);
    if (!Number.isFinite(n) || n < 0) return "max_total inválido";
    max = n;
  }
  if (min !== null && max !== null && min > max) {
    return "min_total no puede ser mayor que max_total";
  }

  for (const key of ["id_producto", "id_cliente", "id_proveedor"] as const) {
    const r = sp.get(key);
    if (r !== null && r !== "") {
      const n = Number.parseInt(r, 10);
      if (!Number.isFinite(n) || n < 1) return `${key} inválido`;
    }
  }

  const per = sp.get("periodo");
  if (per !== null && per !== "" && !PERIODO_INTERVAL[per]) {
    return "periodo inválido (use day, week, month o year)";
  }

  return null;
}

export type HistorialVentasWhereBuilt = {
  /** Fragmento para `WHERE (${whereSql})` — sin `WHERE` inicial. */
  whereSql: string;
  values: unknown[];
};

/**
 * Patrón para ILIKE con comodines; escapa `\`, `%` y `_` para uso con `ESCAPE '\\'`.
 */
export function historialVentasLikePattern(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  const escaped = t
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");
  return `%${escaped}%`;
}

/**
 * Construye condiciones AND sobre `venta v` (y tablas ya unidas: `uc`, `ue`).
 * `omitAmountRange`: para `meta_totales`, excluye `min_total`/`max_total` y deja acotar el slider.
 */
export function buildHistorialVentasWhere(
  sp: URLSearchParams,
  options: { omitAmountRange?: boolean } = {}
): HistorialVentasWhereBuilt {
  const parts: string[] = [];
  const values: unknown[] = [];

  const periodo = sp.get("periodo");
  if (periodo && PERIODO_INTERVAL[periodo]) {
    parts.push(
      `v.fecha_venta >= NOW() - INTERVAL '${PERIODO_INTERVAL[periodo]}'`
    );
  }

  if (!options.omitAmountRange) {
    const rawMin = sp.get("min_total");
    const rawMax = sp.get("max_total");
    if (rawMin !== null && rawMin !== "") {
      const min = Number(rawMin);
      if (Number.isFinite(min) && min >= 0) {
        parts.push(`v.total >= $${values.length + 1}`);
        values.push(min);
      }
    }
    if (rawMax !== null && rawMax !== "") {
      const max = Number(rawMax);
      if (Number.isFinite(max) && max >= 0) {
        parts.push(`v.total <= $${values.length + 1}`);
        values.push(max);
      }
    }
  }

  const rawIdProducto = sp.get("id_producto");
  if (rawIdProducto !== null && rawIdProducto !== "") {
    const id = Number.parseInt(rawIdProducto, 10);
    if (Number.isFinite(id) && id >= 1) {
      parts.push(
        `EXISTS (SELECT 1 FROM detalle_venta dv_f WHERE dv_f.id_venta = v.id_venta AND dv_f.id_producto = $${values.length + 1})`
      );
      values.push(id);
    }
  }

  const rawIdCliente = sp.get("id_cliente");
  if (rawIdCliente !== null && rawIdCliente !== "") {
    const id = Number.parseInt(rawIdCliente, 10);
    if (Number.isFinite(id) && id >= 1) {
      parts.push(`v.id_usuario = $${values.length + 1}`);
      values.push(id);
    }
  }

  const rawIdProveedor = sp.get("id_proveedor");
  if (rawIdProveedor !== null && rawIdProveedor !== "") {
    const id = Number.parseInt(rawIdProveedor, 10);
    if (Number.isFinite(id) && id >= 1) {
      parts.push(
        `EXISTS (
          SELECT 1
          FROM detalle_venta dv_p
          JOIN producto_proveedor pp ON pp.id_producto = dv_p.id_producto
          WHERE dv_p.id_venta = v.id_venta
            AND pp.id_proveedor = $${values.length + 1}
        )`
      );
      values.push(id);
    }
  }

  const qRaw = sp.get("q");
  if (qRaw !== null && qRaw.trim() !== "") {
    const pattern = historialVentasLikePattern(qRaw);
    if (pattern) {
      const p = values.length + 1;
      parts.push(`(
        uc.nombre ILIKE $${p} ESCAPE '\\'
        OR uc.correo ILIKE $${p} ESCAPE '\\'
        OR (ue.nombre IS NOT NULL AND ue.nombre ILIKE $${p} ESCAPE '\\')
        OR CAST(v.id_venta AS TEXT) ILIKE $${p} ESCAPE '\\'
        OR CAST(v.total AS TEXT) ILIKE $${p} ESCAPE '\\'
        OR EXISTS (
          SELECT 1
          FROM detalle_venta dv_q
          JOIN producto p_q ON p_q.id_producto = dv_q.id_producto
          LEFT JOIN producto_proveedor pp_q ON pp_q.id_producto = dv_q.id_producto
          LEFT JOIN proveedor pr_q ON pr_q.id_proveedor = pp_q.id_proveedor
          WHERE dv_q.id_venta = v.id_venta
            AND (
              p_q.nombre_producto ILIKE $${p} ESCAPE '\\'
              OR p_q.codigo_producto ILIKE $${p} ESCAPE '\\'
              OR pr_q.nombre_proveedor ILIKE $${p} ESCAPE '\\'
              OR pr_q.nit_proveedor ILIKE $${p} ESCAPE '\\'
            )
        )
      )`);
      values.push(pattern);
    }
  }

  return {
    whereSql: parts.length > 0 ? parts.join(" AND ") : "TRUE",
    values,
  };
}
