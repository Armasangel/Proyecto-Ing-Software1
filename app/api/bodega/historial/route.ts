import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getUsuarioFromRequest } from "@/lib/server-auth";
import { isBodegueroTipo } from "@/lib/roles";
import { apiError, unauthorizedError } from "@/lib/api-error";

/**
 * GET /api/bodega/historial
 * Últimos movimientos (entrada/salida) de la bodega asignada al bodeguero
 * autenticado. Deliberadamente acotado (por defecto 4, máximo 10) — el
 * historial completo de kardex es exclusivo del dueño.
 */
export async function GET(req: NextRequest) {
  const usuario = getUsuarioFromRequest(req);
  if (!usuario || !isBodegueroTipo(usuario.tipo_usuario) || !usuario.id_bodega) {
    return unauthorizedError();
  }

  const limiteParam = Number(req.nextUrl.searchParams.get("limite"));
  const limite = Number.isFinite(limiteParam) && limiteParam > 0 ? Math.min(limiteParam, 10) : 4;

  try {
    const result = await pool.query(
      `SELECT
         k.id_kardex,
         k.fecha_movimiento,
         k.tipo_movimiento,
         k.cantidad,
         k.descripcion,
         k.motivo,
         p.nombre_producto,
         p.unidad_medida,
         pp.nombre_presentacion,
         k.cantidad_presentacion
       FROM kardex k
       JOIN producto p ON p.id_producto = k.id_producto
       LEFT JOIN presentacion_producto pp ON pp.id_presentacion = k.id_presentacion
       WHERE k.id_bodega = $1
       ORDER BY k.fecha_movimiento DESC, k.id_kardex DESC
       LIMIT $2`,
      [usuario.id_bodega, limite]
    );

    return NextResponse.json({ movimientos: result.rows });
  } catch (error) {
    return apiError("BODEGA HISTORIAL GET", error);
  }
}
