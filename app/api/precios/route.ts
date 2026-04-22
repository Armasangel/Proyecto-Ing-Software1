// app/api/precios/route.ts
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getUsuarioFromRequest } from "@/lib/server-auth";
import { isStaffTipo } from "@/lib/roles";

export async function GET(req: NextRequest) {
  const usuario = getUsuarioFromRequest(req);
  if (!usuario || !isStaffTipo(usuario.tipo_usuario)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
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
    return NextResponse.json(
      { error: "Error al consultar precios", detalle: String(error) },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  const usuario = getUsuarioFromRequest(req);
  if (!usuario || !isStaffTipo(usuario.tipo_usuario)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    const { id_producto, precio_unitario, precio_mayoreo } = await req.json();

    if (!id_producto || precio_unitario == null || precio_mayoreo == null) {
      return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
    }

    await pool.query(
      `UPDATE producto
       SET precio_unitario = $1, precio_mayoreo = $2
       WHERE id_producto = $3`,
      [precio_unitario, precio_mayoreo, id_producto]
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Error al actualizar precio", detalle: String(error) },
      { status: 500 }
    );
  }
}