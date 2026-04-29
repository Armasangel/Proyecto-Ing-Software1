import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getUsuarioFromRequest } from "@/lib/server-auth";
import { isStaffTipo, TIPOS_USUARIO } from "@/lib/roles";
import { apiError, unauthorizedError } from "@/lib/api-error";

export async function GET(req: NextRequest) {
  const usuario = getUsuarioFromRequest(req);
  // FIX: isColaboradorTipo solo permitía EMPLEADO, bloqueando al DUENO.
  // El dueño también necesita consultar clientes (facturación, reportes, etc).
  // isStaffTipo permite tanto DUENO como EMPLEADO.
  if (!usuario || !isStaffTipo(usuario.tipo_usuario)) {
    return unauthorizedError();
  }

  try {
    const result = await pool.query(
      `
      SELECT id_usuario, nombre, correo, tipo_usuario
      FROM usuario
      WHERE tipo_usuario IN ($1, $2)
        AND estado_usuario = TRUE
      ORDER BY nombre
      `,
      [TIPOS_USUARIO.COMPRADOR, TIPOS_USUARIO.COMPRADOR_MAYOR]
    );
    return NextResponse.json({ clientes: result.rows });
  } catch (error) {
    return apiError("CLIENTES GET", error);
  }
}