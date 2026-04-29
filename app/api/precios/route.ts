import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getUsuarioFromRequest } from "@/lib/server-auth";
import { isStaffTipo } from "@/lib/roles";
import { apiError, unauthorizedError, validationError } from "@/lib/api-error";

export async function GET(req: NextRequest) {
  const usuario = getUsuarioFromRequest(req);
  if (!usuario || !isStaffTipo(usuario.tipo_usuario)) {
    return unauthorizedError();
  }

  try {
    const result = await pool.query(`
      SELECT
        p.id_producto,
        p.codigo_producto,
        p.nombre_producto,
        p.precio_unitario,
        p.precio_mayoreo,
        p.unidad_medida,
        c.nombre_categoria
      FROM producto p
      JOIN categoria c ON c.id_categoria = p.id_categoria
      ORDER BY p.nombre_producto
    `);
    return NextResponse.json({ productos: result.rows });
  } catch (error) {
    return apiError("PRECIOS GET", error);
  }
}

export async function PATCH(req: NextRequest) {
  const usuario = getUsuarioFromRequest(req);
  if (!usuario || !isStaffTipo(usuario.tipo_usuario)) {
    return unauthorizedError();
  }

  try {
    const { id_producto, precio_unitario, precio_mayoreo } = await req.json();

    if (!id_producto || precio_unitario == null || precio_mayoreo == null) {
      return validationError("Datos incompletos");
    }

    await pool.query(
      `UPDATE producto
       SET precio_unitario = $1, precio_mayoreo = $2
       WHERE id_producto = $3`,
      [precio_unitario, precio_mayoreo, id_producto]
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError("PRECIOS PATCH", error);
  }
}