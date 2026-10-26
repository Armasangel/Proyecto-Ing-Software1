/** Cálculos compartidos entre la comparativa del dueño y la validación del servidor. */
export const redondear = (n: number, decimales = 2) => Math.round((n + Number.EPSILON) * 10 ** decimales) / 10 ** decimales;
export const margen = (venta: number | null, costo: number | null) =>
  venta != null && venta > 0 && costo != null ? (venta - costo) / venta * 100 : null;
export const recargo = (venta: number | null, costo: number | null) =>
  venta != null && costo != null && costo > 0 ? (venta - costo) / costo * 100 : null;

export type ImpuestoCompra = { nombre: string; porcentaje: number; monto: number };
/** Impuestos independientes sobre el subtotal neto; no se capitalizan entre sí. */
export function calcularImpuestos(subtotal: number, descuento: number, tasas: {nombre:string;porcentaje:number}[]): ImpuestoCompra[] {
  const base = Math.max(0, redondear(subtotal-descuento));
  return tasas.map(t=>({...t,monto:redondear(base*t.porcentaje/100)}));
}
/** Siempre compara por unidad base, desde la primera compra, con gastos prorrateados. */
export function costoUnitarioCompra(cantidad: number, costoPresentacion: number, factor: number, total: number, subtotal: number) {
  const base=redondear(cantidad*factor,3);
  return base>0 && subtotal>0 ? redondear(redondear(cantidad*costoPresentacion)/base*total/subtotal,6) : 0;
}

export type Conteo = {
  id_producto: number;
  cantidad: number;
  id_presentacion: number | null;
  nombre_presentacion: string | null;
  factor_conversion: number;
  cantidad_base: number;
  unidad_base: string;
};
export type Esperado = { id_producto: number; cantidad_base: number | string; unidad_base: string; tolerancia_base?: number | string };

export function compararRecepcion(esperados: Esperado[], conteo: Conteo[], tolerancia: number) {
  const diferencias = esperados.map(e => {
    const recibido = conteo.find(c => c.id_producto === e.id_producto);
    const cantidad = recibido?.cantidad_base ?? 0;
    const diferencia = redondear(cantidad - Number(e.cantidad_base), 3);
    return {
      id_producto: e.id_producto, esperado: Number(e.cantidad_base), recibido: cantidad, diferencia,
      // Nunca convertir entre unidades incompatibles, incluso con tolerancia.
      dentro: (!recibido || recibido.unidad_base === e.unidad_base) &&
        Math.abs(diferencia) <= Number(e.tolerancia_base ?? e.cantidad_base) * tolerancia / 100 + 0.0000001,
    };
  });
  const extras = conteo.some(c => !esperados.some(e => e.id_producto === c.id_producto));
  return { coincide: !extras && diferencias.every(d => d.diferencia === 0 && d.dentro), aceptable: !extras && diferencias.every(d => d.dentro), diferencias };
}

export class CompraError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export function numero(valor: unknown, nombre: string, min = 0, max = 999999999, decimales = 3) {
  if ((typeof valor !== "number" && typeof valor !== "string") || valor === "" ||
      (typeof valor === "string" && !valor.trim())) throw new CompraError(`${nombre} es obligatorio.`);
  const n = Number(valor);
  if (!Number.isFinite(n) || n < min || n > max || Math.abs(n - redondear(n, decimales)) > 0.00000001)
    throw new CompraError(`${nombre} inválido.`);
  return n;
}
export const identificador = (valor: unknown) => numero(valor, "Identificador", 1, 2147483647, 0);
export function texto(valor: unknown, nombre: string, max: number, obligatorio = false) {
  if (valor != null && typeof valor !== "string") throw new CompraError(`${nombre} inválido.`);
  const s = typeof valor === "string" ? valor.trim() : "";
  if (s.length > max || (obligatorio && !s)) throw new CompraError(`${nombre} ${s ? "es demasiado largo" : "es obligatorio"}.`);
  return s;
}
export function fecha(valor: unknown, nombre: string, opcional = false) {
  if (opcional && !valor) return null;
  if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor) ||
      !Number.isFinite(Date.parse(valor)) || new Date(valor).toISOString().slice(0, 10) !== valor)
    throw new CompraError(`${nombre} inválida.`);
  return valor;
}
export function clave(valor: unknown) {
  if (typeof valor !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(valor))
    throw new CompraError("Clave de operación inválida.");
  return valor;
}
