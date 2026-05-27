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
      `SELECT id_categoria, nombre_categoria FROM categoria ORDER BY nombre_categoria`
    );
    return NextResponse.json({ categorias: result.rows });
  } catch (error) {
    return apiError("CATEGORIAS GET", error);
  }
}