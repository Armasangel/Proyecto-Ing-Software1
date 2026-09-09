import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getUsuarioFromRequest } from "@/lib/server-auth";
import { isBodegueroTipo, isStaffTipo } from "@/lib/roles";
import { apiError, unauthorizedError } from "@/lib/api-error";

/**
 * GET /api/bodegas/simple
 * Lista liviana de bodegas (solo id y nombre, sin stock) para selectores
 * como el destino de un traslado. A diferencia de /api/bodegas, el bodeguero
 * también puede consultarla (no ve niveles de stock de otras bodegas).
 */
export async function GET(req: NextRequest) {
  const usuario = getUsuarioFromRequest(req);
  if (!usuario || !(isStaffTipo(usuario.tipo_usuario) || isBodegueroTipo(usuario.tipo_usuario))) {
    return unauthorizedError();
  }

  try {
    const result = await pool.query(
      `SELECT id_bodega, nombre_bodega FROM bodega ORDER BY nombre_bodega`
    );
    return NextResponse.json({ bodegas: result.rows });
  } catch (error) {
    return apiError("BODEGAS SIMPLE GET", error);
  }
}
