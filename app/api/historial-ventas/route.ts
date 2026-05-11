import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getUsuarioFromRequest } from "@/lib/server-auth";
import { isDuenoTipo } from "@/lib/roles";
import { apiError, unauthorizedError } from "@/lib/api-error";
import {
  buildHistorialPaginationMeta,
  parseHistorialPagination,
} from "@/lib/historial-ventas";

export async function GET(req: NextRequest) {
  const usuario = getUsuarioFromRequest(req);
  if (!usuario || !isDuenoTipo(usuario.tipo_usuario)) {
    return unauthorizedError();
  }

  const { limit, offset, fetchLimit } = parseHistorialPagination(
    req.nextUrl.searchParams
  );

  try {
    const result = await pool.query(
      `
      SELECT
        v.id_venta,
        v.id_usuario,
        v.id_empleado,
        v.fecha_venta,
        v.estado_venta,
        v.tipo_venta,
        v.tipo_entrega,
        v.direccion_entrega,
        v.enlinea,
        v.total,
        v.fecha_limite_pago,
        uc.nombre AS nombre_cliente,
        uc.correo AS correo_cliente,
        ue.nombre AS nombre_colaborador,
        COALESCE(
          json_agg(
            json_build_object(
              'id_detalle', dv.id_detalle_venta,
              'id_venta', dv.id_venta,
              'codigo_producto', p.codigo_producto,
              'nombre_producto', p.nombre_producto,
              'id_producto', dv.id_producto,
              'cantidad', dv.cantidad,
              'precio_unitario_venta', dv.precio_unitario,
              'subtotal', dv.subtotal
            )
            ORDER BY dv.id_detalle_venta
          ) FILTER (WHERE dv.id_detalle_venta IS NOT NULL),
          '[]'::json
        ) AS productos
      FROM venta v
      JOIN usuario uc ON uc.id_usuario = v.id_usuario
      LEFT JOIN usuario ue ON ue.id_usuario = v.id_empleado
      LEFT JOIN detalle_venta dv ON dv.id_venta = v.id_venta
      LEFT JOIN producto p ON p.id_producto = dv.id_producto
      GROUP BY
        v.id_venta,
        v.id_usuario,
        v.id_empleado,
        v.fecha_venta,
        v.estado_venta,
        v.tipo_venta,
        v.tipo_entrega,
        v.direccion_entrega,
        v.enlinea,
        v.total,
        v.fecha_limite_pago,
        uc.nombre,
        uc.correo,
        ue.nombre
      ORDER BY v.fecha_venta DESC, v.id_venta DESC
      LIMIT $1 OFFSET $2
      `,
      [fetchLimit, offset]
    );

    const rows = result.rows as Record<string, unknown>[];
    const hasMore = rows.length > limit;
    const ventas = hasMore ? rows.slice(0, limit) : rows;
    const pagination = buildHistorialPaginationMeta(
      limit,
      offset,
      hasMore,
      ventas.length
    );

    return NextResponse.json({ ventas, pagination });
  } catch (error) {
    return apiError("HISTORIAL_VENTAS GET", error);
  }
}
