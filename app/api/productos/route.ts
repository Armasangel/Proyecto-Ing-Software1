// app/api/productos/route.ts
// Endpoint de ejemplo: GET /api/productos
// Trae todos los productos con su categoría y marca

import { NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

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