import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getUsuarioFromRequest } from "@/lib/server-auth";
import { isBodegueroTipo } from "@/lib/roles";

// Tablero "en vivo" de pedidos para el panel de bodega: muestra las ordenes
// creadas por dueno/colaborador (via /ordenes) que tienen al menos una linea
// asignada a la bodega del bodeguero autenticado, en los estados que le
// corresponde preparar. Pensado para refrescarse por polling, como una
// pantalla de ordenes de comida rapida.
const ESTADOS_TABLERO = ["CONFIRMADO", "EN_PREPARACION", "ENVIADO"] as const;

export async function GET(req: NextRequest) {
  const usuario = getUsuarioFromRequest(req);
  if (!usuario || !isBodegueroTipo(usuario.tipo_usuario) || !usuario.id_bodega) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    const result = await pool.query(
      `
      SELECT
        o.id_orden,
        o.fecha_orden,
        o.estado,
        o.notas,
        o.total,
        c.nombre AS nombre_cliente,
        COALESCE(
          json_agg(
            json_build_object(
              'id_detalle', d.id_detalle,
              'codigo_producto', p.codigo_producto,
              'nombre_producto', p.nombre_producto,
              'cantidad', d.cantidad,
              'unidad_medida', p.unidad_medida,
              'id_bodega', d.id_bodega,
              'es_mi_bodega', d.id_bodega = $1
            )
            ORDER BY d.id_detalle
          ) FILTER (WHERE d.id_detalle IS NOT NULL),
          '[]'::json
        ) AS productos
      FROM orden o
      JOIN cliente c ON c.id_cliente = o.id_cliente
      JOIN detalle_orden d ON d.id_orden = o.id_orden
      LEFT JOIN producto p ON p.id_producto = d.id_producto
      WHERE o.estado = ANY($2::varchar[])
        AND EXISTS (
          SELECT 1 FROM detalle_orden d2
          WHERE d2.id_orden = o.id_orden AND d2.id_bodega = $1
        )
      GROUP BY o.id_orden, o.fecha_orden, o.estado, o.notas, o.total, c.nombre
      ORDER BY
        CASE o.estado WHEN 'CONFIRMADO' THEN 0 WHEN 'EN_PREPARACION' THEN 1 ELSE 2 END,
        o.fecha_orden ASC
      `,
      [usuario.id_bodega, ESTADOS_TABLERO]
    );

    return NextResponse.json({ pedidos: result.rows });
  } catch (error) {
    console.error("[BODEGA PEDIDOS GET]", error);
    return NextResponse.json({ error: "Error al consultar pedidos" }, { status: 500 });
  }
}
