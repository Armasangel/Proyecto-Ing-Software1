import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getUsuarioFromRequest } from "@/lib/server-auth";
import { TIPOS_USUARIO } from "@/lib/roles";

export async function GET(req: NextRequest) {
  const usuario = getUsuarioFromRequest(req);
  if (!usuario) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const minorista = usuario.tipo_usuario === TIPOS_USUARIO.COMPRADOR;
  const mayorista = usuario.tipo_usuario === TIPOS_USUARIO.COMPRADOR_MAYOR;
  if (!minorista && !mayorista) {
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
        c.nombre_categoria,
        m.nombre_marca,
        COALESCE(SUM(bp.cantidad_disponible), 0)::numeric AS stock_total
      FROM producto p
      JOIN categoria c ON c.id_categoria = p.id_categoria
      JOIN marca m ON m.id_marca = p.id_marca
      LEFT JOIN bodega_producto bp ON bp.id_producto = p.id_producto
      WHERE p.estado_producto = TRUE
      GROUP BY p.id_producto, c.nombre_categoria, m.nombre_marca
      ORDER BY c.nombre_categoria, p.nombre_producto
    `);

    const modo = minorista ? "minorista" : "mayorista";

    const productos = result.rows.map((row: Record<string, unknown>) => {
      const unit = Number(row.precio_unitario);
      const mayor = Number(row.precio_mayoreo);
      const precio = minorista ? unit : mayor;
      return {
        id_producto: row.id_producto,
        codigo_producto: row.codigo_producto,
        nombre_producto: row.nombre_producto,
        unidad_medida: row.unidad_medida,
        nombre_categoria: row.nombre_categoria,
        nombre_marca: row.nombre_marca,
        stock_total: Number(row.stock_total),
        precio_unitario: unit,
        precio_mayoreo: mayor,
        precio,
        modo,
      };
    });

    return NextResponse.json({ productos, modo });
  } catch (error) {
    return NextResponse.json(
      { error: "Error al cargar catálogo", detalle: String(error) },
      { status: 500 }
    );
  }
}
