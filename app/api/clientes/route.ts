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
      `SELECT id_cliente, nombre, correo, tipo_cliente
       FROM cliente
       WHERE estado_cliente = TRUE
       ORDER BY nombre`
    );
    return NextResponse.json({ clientes: result.rows });
  } catch (error) {
    return apiError("CLIENTES GET", error);
  }
}