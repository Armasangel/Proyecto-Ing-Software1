import type { PoolClient } from "pg";
import { normalizarPresentacion, normalizarUnidad, type Presentacion } from "@/lib/presentaciones";

export class PresentacionError extends Error {}

/** Conserva IDs y factores usados por ventas/kardex; quitar solo desactiva. */
export async function guardarPresentaciones(client: PoolClient, idProducto: number, seleccionadas: Presentacion[], unidad: string) {
  const unidadBase = normalizarUnidad(unidad);
  const result = await client.query(
    `SELECT id_presentacion, nombre_presentacion, factor_conversion, unidad_base
     FROM presentacion_producto WHERE id_producto = $1 FOR UPDATE`, [idProducto]
  );
  const existentes = result.rows as { id_presentacion: number; nombre_presentacion: string; factor_conversion: string; unidad_base: string }[];
  const resueltas = seleccionadas.map((p) => {
    const existente = p.id_presentacion !== undefined
      ? existentes.find((e) => e.id_presentacion === p.id_presentacion)
      : existentes.find((e) => e.unidad_base === unidadBase && normalizarPresentacion(e.nombre_presentacion) === normalizarPresentacion(p.nombre_presentacion));
    if (p.id_presentacion !== undefined && !existente) throw new PresentacionError("La presentación no pertenece a este producto.");
    if (existente && existente.unidad_base !== unidadBase) throw new PresentacionError("Quita las presentaciones de la unidad anterior y selecciona las de la nueva unidad base.");
    if (existente && (normalizarPresentacion(existente.nombre_presentacion) !== normalizarPresentacion(p.nombre_presentacion) || Number(existente.factor_conversion) !== p.factor_conversion)) {
      throw new PresentacionError("Una presentación existente conserva su equivalencia para proteger el historial. Crea otra con un nombre diferente.");
    }
    return { ...p, id_presentacion: existente?.id_presentacion };
  });
  const ids = resueltas.flatMap((p) => p.id_presentacion === undefined ? [] : [p.id_presentacion]);
  await client.query(
    `UPDATE presentacion_producto SET estado_presentacion = (id_presentacion = ANY($2::int[])) WHERE id_producto = $1`,
    [idProducto, ids]
  );
  for (const p of resueltas.filter((p) => p.id_presentacion === undefined)) {
    await client.query(
      `INSERT INTO presentacion_producto (id_producto, nombre_presentacion, factor_conversion, unidad_base) VALUES ($1, $2, $3, $4)`,
      [idProducto, p.nombre_presentacion.trim(), p.factor_conversion, unidadBase]
    );
  }
}
