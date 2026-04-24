// ─── app/api/bodegas/route.ts ────────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getUsuarioFromRequest } from "@/lib/server-auth";
import { isStaffTipo } from "@/lib/roles";
import { apiError, unauthorizedError } from "@/lib/api-error";

export async function GET(req: NextRequest) {
  const usuario = getUsuarioFromRequest(req);
  if (!usuario || !isStaffTipo(usuario.tipo_usuario)) {
    return unauthorizedError();
  }

  try {
    const result = await pool.query(
      `SELECT id_bodega, nombre_bodega, ubicacion FROM bodega ORDER BY nombre_bodega`
    );
    return NextResponse.json({ bodegas: result.rows });
  } catch (error) {
    return apiError("BODEGAS GET", error);
  }
}