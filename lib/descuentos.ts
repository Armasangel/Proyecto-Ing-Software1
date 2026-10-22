// lib/descuentos.ts
//
// Lógica pura (sin base de datos) del sistema de descuentos. Un descuento es
// una regla con tramos por cantidad de unidades; cada tramo aplica un
// porcentaje desde cierta cantidad. El servidor calcula el descuento siempre
// aquí, nunca desde lo que mande el cliente.
//
// El dinero se maneja en centavos para evitar errores de coma flotante.

import { TIPOS_CLIENTE, esTipoCliente } from "@/lib/tipos-cliente";

export const TIPOS_DESCUENTO = ["PORCENTAJE", "CANTIDAD", "ESCALA"] as const;
export type TipoDescuento = (typeof TIPOS_DESCUENTO)[number];

export function isTipoDescuento(valor: unknown): valor is TipoDescuento {
  return typeof valor === "string" && (TIPOS_DESCUENTO as readonly string[]).includes(valor);
}

/** Un tramo: desde `cantidad_desde` unidades (inclusive) aplica `porcentaje`. */
export type Tramo = {
  cantidad_desde: number;
  porcentaje: number;
};

/** Regla completa: identidad + tramos. */
export type Descuento = {
  id_descuento: number;
  nombre: string;
  tipo: TipoDescuento;
  tramos: Tramo[];
};

/**
 * Porcentaje que corresponde a una cantidad según los tramos: el del tramo de
 * mayor `cantidad_desde` que no supere la cantidad. 0 si ninguno aplica (no
 * debe haber tramos con cantidad_desde < 0, pero se es defensivo).
 */
export function porcentajeAplicable(cantidad: number, tramos: Tramo[]): number {
  let mejor: Tramo | null = null;
  for (const t of tramos) {
    if (cantidad >= t.cantidad_desde && (mejor === null || t.cantidad_desde > mejor.cantidad_desde)) {
      mejor = t;
    }
  }
  return mejor ? mejor.porcentaje : 0;
}

export type DescuentoLinea = {
  porcentaje: number;
  monto: number;
};

/**
 * Descuento de una línea en centavos exactos. `cantidadBase` es la cantidad en
 * unidad base; `precioUnitario` el precio por unidad base; `subtotalBruto` el
 * subtotal sin descuento (cantidad base × precio). Si no aplica ningún tramo,
 * devuelve { porcentaje: 0, monto: 0 }.
 */
export function calcularDescuentoLinea(
  cantidadBase: number,
  subtotalBruto: number,
  tramos: Tramo[]
): DescuentoLinea {
  const porcentaje = porcentajeAplicable(cantidadBase, tramos);
  if (porcentaje <= 0) return { porcentaje: 0, monto: 0 };
  const brutoCent = Math.round(subtotalBruto * 100);
  const montoCent = Math.round((brutoCent * porcentaje) / 100);
  return { porcentaje, monto: montoCent / 100 };
}

/**
 * De varias reglas que aplican a una venta, cuál da el MAYOR descuento para una
 * línea (no se acumulan). Devuelve la regla ganadora y el descuento, o null si
 * ninguna aplica.
 */
export function elegirMejorDescuento(
  cantidadBase: number,
  subtotalBruto: number,
  reglas: Descuento[]
): { descuento: Descuento; porcentaje: number; monto: number } | null {
  let mejor: { descuento: Descuento; porcentaje: number; monto: number } | null = null;
  for (const regla of reglas) {
    const { porcentaje, monto } = calcularDescuentoLinea(cantidadBase, subtotalBruto, regla.tramos);
    if (monto <= 0) continue;
    if (mejor === null || monto > mejor.monto) {
      mejor = { descuento: regla, porcentaje, monto };
    }
  }
  return mejor;
}

export type ErrorDescuento = string;

/**
 * Valida una regla tal como la manda el dueño: nombre, tipo y al menos un
 * tramo. Cada tramo: cantidad_desde >= 0 y porcentaje entre 0 y 100. Devuelve
 * el mensaje de error o null si está bien.
 */
export function validarDescuento(nombre: unknown, tipo: unknown, tramos: unknown): ErrorDescuento | null {
  if (typeof nombre !== "string" || nombre.trim() === "") {
    return "El nombre del descuento es obligatorio";
  }
  if (!isTipoDescuento(tipo)) {
    return "El tipo debe ser PORCENTAJE, CANTIDAD o ESCALA";
  }
  if (!Array.isArray(tramos) || tramos.length === 0) {
    return "El descuento necesita al menos un tramo";
  }
  const vistos = new Set<number>();
  for (const t of tramos) {
    if (!t || typeof t !== "object") return "Cada tramo debe tener cantidad_desde y porcentaje";
    const o = t as Record<string, unknown>;
    const desde = Number(o.cantidad_desde);
    const pct = Number(o.porcentaje);
    if (!Number.isFinite(desde) || desde < 0) return "La cantidad desde no puede ser negativa";
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) return "El porcentaje debe estar entre 0 y 100";
    if (vistos.has(desde)) return "No puede haber dos tramos con la misma cantidad desde";
    vistos.add(desde);
  }
  return null;
}

/** Cliente de consulta mínimo (compatible con pg.Pool y pg.PoolClient). */
export type Queryable = {
  query: (text: string, params?: unknown[]) => Promise<{ rows: unknown[]; rowCount: number | null }>;
};

/**
 * Reglas activas que aplican a un cliente: las asignadas a ese cliente
 * puntualmente y las asignadas a su tipo de cliente. Cada regla viene con sus
 * tramos. El llamador (POST /api/ventas) la invoca una sola vez dentro de la
 * transacción.
 */
export async function cargarDescuentosAplicables(
  client: Queryable,
  idCliente: number,
  tipoCliente: string
): Promise<Descuento[]> {
  const reglasRes = await client.query(
    `SELECT DISTINCT d.id_descuento, d.nombre, d.tipo
       FROM descuento d
       JOIN descuento_asignacion a ON a.id_descuento = d.id_descuento
      WHERE d.activo = TRUE
        AND (a.id_cliente = $1 OR a.tipo_cliente = $2)`,
    [idCliente, tipoCliente]
  );
  const reglas = reglasRes.rows as Array<{ id_descuento: number; nombre: string; tipo: string }>;
  if (reglas.length === 0) return [];

  const ids = reglas.map((r) => r.id_descuento);
  const tramosRes = await client.query(
    `SELECT id_descuento, cantidad_desde, porcentaje
       FROM descuento_tramo
      WHERE id_descuento = ANY($1)
      ORDER BY id_descuento, cantidad_desde`,
    [ids]
  );

  return reglas.map((r) => ({
    id_descuento: r.id_descuento,
    nombre: r.nombre,
    tipo: isTipoDescuento(r.tipo) ? r.tipo : "PORCENTAJE",
    tramos: (tramosRes.rows as Array<{ id_descuento: number; cantidad_desde: string | number; porcentaje: string | number }>)
      .filter((t) => t.id_descuento === r.id_descuento)
      .map((t) => ({ cantidad_desde: Number(t.cantidad_desde), porcentaje: Number(t.porcentaje) })),
  }));
}

export type ErrorAsignacion = string;

/**
 * Valida una asignación: o un cliente (id_cliente > 0) o un tipo de cliente
 * (MINORISTA/MAYORISTA/EMPRESA/GOBIERNO), nunca ambos ni ninguno.
 */
export function validarAsignacion(idCliente: unknown, tipoCliente: unknown): ErrorAsignacion | null {
  const hayCliente = idCliente != null && String(idCliente).trim() !== "";
  const hayTipo = tipoCliente != null && String(tipoCliente).trim() !== "";
  if (hayCliente === hayTipo) {
    return "La asignación debe ser a un cliente O a un tipo de cliente, no ambos";
  }
  if (hayCliente && !(Number(idCliente) > 0)) {
    return "El cliente indicado no es válido";
  }
  if (hayTipo && !esTipoCliente(tipoCliente)) {
    return `El tipo de cliente debe ser ${TIPOS_CLIENTE.join(" o ")}`;
  }
  return null;
}
