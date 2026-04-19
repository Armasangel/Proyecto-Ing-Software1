import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getUsuarioFromRequest } from "@/lib/server-auth";
import { isStaffTipo } from "@/lib/roles";

/** Listado de inventario con stock agregado — solo personal (dueño / colaborador). */
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
        p.estado_producto,
        c.nombre_categoria,
        m.nombre_marca,
        COALESCE(SUM(bp.cantidad_disponible), 0)::numeric AS stock_total
      FROM producto p
      JOIN categoria c ON c.id_categoria = p.id_categoria
      JOIN marca m ON m.id_marca = p.id_marca
      LEFT JOIN bodega_producto bp ON bp.id_producto = p.id_producto
      GROUP BY p.id_producto, c.nombre_categoria, m.nombre_marca
      ORDER BY p.nombre_producto
    `);

    return NextResponse.json({ productos: result.rows });
  } catch (error) {
    return NextResponse.json(
      { error: "Error al consultar inventario", detalle: String(error) },
      { status: 500 }
    );
  }
}
