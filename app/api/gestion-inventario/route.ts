import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getUsuarioFromRequest } from "@/lib/server-auth";
import { isDuenoTipo } from "@/lib/roles";

/**
 * GET /api/gestion-inventario
 * Stock por bodega + producto (para pantalla "Gestión inventario" — solo dueño).
 */
export async function GET(req: NextRequest) {
  const usuario = getUsuarioFromRequest(req);
  if (!usuario || !isDuenoTipo(usuario.tipo_usuario)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const idBodegaRaw = searchParams.get("id_bodega");
  const idProductoRaw = searchParams.get("id_producto");
  const soloBajoMinimo = searchParams.get("solo_bajo_minimo") === "1" || searchParams.get("solo_bajo_minimo") === "true";
  const incluirInactivos = searchParams.get("incluir_inactivos") === "1" || searchParams.get("incluir_inactivos") === "true";

  const idBodega = idBodegaRaw ? Number(idBodegaRaw) : null;
  const idProducto = idProductoRaw ? Number(idProductoRaw) : null;

  if (idBodegaRaw && (!idBodega || idBodega < 1)) {
    return NextResponse.json({ error: "id_bodega inválido" }, { status: 400 });
  }
  if (idProductoRaw && (!idProducto || idProducto < 1)) {
    return NextResponse.json({ error: "id_producto inválido" }, { status: 400 });
  }

  try {
    const result = await pool.query(
      `
      SELECT
        bp.id_bodega,
        b.nombre_bodega,
        b.ubicacion,
        bp.id_producto,
        p.codigo_producto,
        p.nombre_producto,
        p.unidad_medida,
        p.estado_producto,
        c.nombre_categoria,
        m.nombre_marca,
        bp.cantidad_disponible,
        bp.stock_minimo,
        bp.ultima_actualizacion,
        (bp.cantidad_disponible < bp.stock_minimo) AS bajo_minimo
      FROM bodega_producto bp
      JOIN bodega b ON b.id_bodega = bp.id_bodega
      JOIN producto p ON p.id_producto = bp.id_producto
      JOIN categoria c ON c.id_categoria = p.id_categoria
      JOIN marca m ON m.id_marca = p.id_marca
      WHERE ($1::int IS NULL OR bp.id_bodega = $1)
        AND ($2::int IS NULL OR bp.id_producto = $2)
        AND ($3::boolean = TRUE OR p.estado_producto = TRUE)
        AND ($4::boolean = FALSE OR bp.cantidad_disponible < bp.stock_minimo)
      ORDER BY b.nombre_bodega, p.nombre_producto
      `,
      [idBodega, idProducto, incluirInactivos, soloBajoMinimo]
    );

    const filas = result.rows as Array<Record<string, unknown>>;
    const bajoMinimo = filas.filter((r) => r.bajo_minimo === true).length;

    return NextResponse.json({
      stock: filas,
      resumen: {
        filas: filas.length,
        bajo_minimo: bajoMinimo,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Error al consultar gestión de inventario", detalle: String(error) },
      { status: 500 }
    );
  }
}
