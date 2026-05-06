import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getUsuarioFromRequest } from "@/lib/server-auth";
import { isColaboradorTipo, TIPOS_USUARIO } from "@/lib/roles";
import { apiError, unauthorizedError } from "@/lib/api-error";

export async function GET(req: NextRequest) {
  const usuario = getUsuarioFromRequest(req);
  if (!usuario || !isColaboradorTipo(usuario.tipo_usuario)) {
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