import type { LineaVenta, Presentacion } from "@/lib/types/ventas";

export function hoyLocalISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function formatoFecha(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function nuevaLinea(): LineaVenta {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    id_producto: "",
    id_bodega: "",
    cantidad: "",
    id_presentacion: "",
    precio_unitario_venta: "",
  };
}

export function factorDeLinea(ln: LineaVenta, presentacionesPorProducto: Record<number, Presentacion[]>): number {
  if (!ln.id_presentacion) return 1;
  const lista = presentacionesPorProducto[Number(ln.id_producto)] || [];
  const pres = lista.find((p) => p.id_presentacion === Number(ln.id_presentacion));
  return pres ? Number(pres.factor_conversion) || 1 : 1;
}
