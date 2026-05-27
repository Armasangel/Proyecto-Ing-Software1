export const DEUDORES_SORT_COLUMNS = {
  monto: "deuda_pendiente",
  fecha_limite_pago: "fecha_limite_pago",
  dias_atraso: "dias_atraso",
} as const;

export type DeudoresSort = keyof typeof DEUDORES_SORT_COLUMNS;

export type DeudoresFilters = {
  q?: string;
  estado?: string;
  fecha_desde?: string;
  fecha_hasta?: string;
  sort?: string;
  order?: string;
  page?: number;
  limit?: number;
};

export function buildDeudoresWhere(filters: DeudoresFilters): {
  where: string;
  values: unknown[];
} {
  const conditions = ["1=1"];
  const values: unknown[] = [];

  const q = filters.q?.trim();
  if (q) {
    values.push(`%${q}%`);
    conditions.push(`nombre_cliente ILIKE $${values.length}`);
  }

  const estado = filters.estado?.trim().toLowerCase();
  if (estado === "activo") {
    conditions.push(`estado_cobro = 'ACTIVO'`);
  } else if (estado === "critico") {
    conditions.push(`estado_cobro = 'CRITICO'`);
  } else if (estado === "vencido") {
    conditions.push(`estado_cobro = 'VENCIDO'`);
  }

  if (filters.fecha_desde?.trim()) {
    values.push(filters.fecha_desde.trim());
    conditions.push(`fecha_limite_pago >= $${values.length}`);
  }

  if (filters.fecha_hasta?.trim()) {
    values.push(filters.fecha_hasta.trim());
    conditions.push(`fecha_limite_pago <= $${values.length}`);
  }

  return { where: conditions.join(" AND "), values };
}

export function buildDeudoresOrder(filters: DeudoresFilters): string {
  const sortKey = filters.sort ?? "fecha_limite_pago";
  const col =
    sortKey in DEUDORES_SORT_COLUMNS
      ? DEUDORES_SORT_COLUMNS[sortKey as DeudoresSort]
      : "fecha_limite_pago";
  const order = filters.order?.toLowerCase() === "desc" ? "DESC" : "ASC";

  if (col === "fecha_limite_pago") {
    return `${col} ${order} NULLS LAST, id_venta DESC`;
  }
  return `${col} ${order}, id_venta DESC`;
}

export function parseDeudoresFilters(
  searchParams: URLSearchParams
): DeudoresFilters {
  return {
    q: searchParams.get("q") ?? undefined,
    estado: searchParams.get("estado") ?? undefined,
    fecha_desde: searchParams.get("fecha_desde") ?? undefined,
    fecha_hasta: searchParams.get("fecha_hasta") ?? undefined,
    sort: searchParams.get("sort") ?? undefined,
    order: searchParams.get("order") ?? undefined,
    page: Math.max(1, Number(searchParams.get("page") ?? "1")),
    limit: Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? "50"))),
  };
}

export function deudoresFiltersToSearchParams(
  filters: DeudoresFilters
): URLSearchParams {
  const sp = new URLSearchParams();
  if (filters.q) sp.set("q", filters.q);
  if (filters.estado) sp.set("estado", filters.estado);
  if (filters.fecha_desde) sp.set("fecha_desde", filters.fecha_desde);
  if (filters.fecha_hasta) sp.set("fecha_hasta", filters.fecha_hasta);
  if (filters.sort) sp.set("sort", filters.sort);
  if (filters.order) sp.set("order", filters.order);
  if (filters.page && filters.page > 1) sp.set("page", String(filters.page));
  if (filters.limit && filters.limit !== 50) {
    sp.set("limit", String(filters.limit));
  }
  return sp;
}
