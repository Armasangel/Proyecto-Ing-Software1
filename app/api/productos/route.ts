// app/api/productos/route.ts
import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET() {
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
        m.nombre_marca
      FROM producto p
      JOIN categoria c ON c.id_categoria = p.id_categoria
      JOIN marca     m ON m.id_marca     = p.id_marca
      ORDER BY p.nombre_producto
    `);

    return NextResponse.json({ productos: result.rows });
  } catch (error) {
    return NextResponse.json(
      { error: "Error al consultar productos", detalle: String(error) },
      { status: 500 }
    );
  }
}