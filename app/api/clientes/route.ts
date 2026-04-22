import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getUsuarioFromRequest } from "@/lib/server-auth";
import { isStaffTipo, TIPOS_USUARIO } from "@/lib/roles";

/** Clientes de tienda (compradores) para registrar ventas desde el panel de staff. */
export async function GET(req: NextRequest) {
  const usuario = getUsuarioFromRequest(req);
  if (!usuario || !isStaffTipo(usuario.tipo_usuario)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
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
    return NextResponse.json(
      { error: "Error al consultar clientes", detalle: String(error) },
      { status: 500 }
    );
  }
}
