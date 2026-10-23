import type { VentaHistorial } from "@/lib/types/historial-ventas";

export function num(v: string | number | unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number.parseFloat(v) || 0;
  return 0;
}

export function estadoClass(estado: string): string {
  if (estado === "PAGADO")
    return "bg-[var(--success-bg)] text-success border-[var(--success-border)]";
  if (estado === "PENDIENTE")
    return "bg-[var(--info-chip)] text-info border-[var(--info-border)]";
  return "bg-surface-soft text-ink-muted border-line";
}

export function buildHistorialParams(opts: {
  q: string;
  periodo: string;
  fechaDesde: string;
  fechaHasta: string;
  idProducto: number | null;
  idCliente: number | null;
  idProveedor: number | null;
  minTotal: number | null;
  maxTotal: number | null;
  skipAmountFilter?: boolean;
  limit: number;
  offset: number;
  metaTotales: boolean;
}): string {
  const sp = new URLSearchParams();
  if (opts.q.trim()) sp.set("q", opts.q.trim());
  if (opts.periodo) sp.set("periodo", opts.periodo);
  if (opts.fechaDesde) sp.set("fecha_desde", opts.fechaDesde);
  if (opts.fechaHasta) sp.set("fecha_hasta", opts.fechaHasta);
  if (opts.idProducto != null) sp.set("id_producto", String(opts.idProducto));
  if (opts.idCliente != null) sp.set("id_cliente", String(opts.idCliente));
  if (opts.idProveedor != null) sp.set("id_proveedor", String(opts.idProveedor));
  if (!opts.skipAmountFilter) {
    if (opts.minTotal != null) sp.set("min_total", String(opts.minTotal));
    if (opts.maxTotal != null) sp.set("max_total", String(opts.maxTotal));
  }
  sp.set("limit", String(opts.limit));
  sp.set("offset", String(opts.offset));
  if (opts.metaTotales) sp.set("meta_totales", "1");
  return sp.toString();
}

export function resumenLineas(v: VentaHistorial): string {
  const arr = Array.isArray(v.productos) ? v.productos : [];
  if (arr.length === 0) return "—";
  if (arr.length === 1) {
    return `${arr[0].nombre_producto ?? arr[0].codigo_producto ?? "Producto"}`;
  }
  return `${arr.length} productos`;
}
