import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getUsuarioFromRequest } from "@/lib/server-auth";
import { isDuenoTipo } from "@/lib/roles";
import {
  apiError,
  unauthorizedError,
  validationError,
} from "@/lib/api-error";
import {
  buildHistorialPaginationMeta,
  buildHistorialVentasWhere,
  parseHistorialPagination,
  validateHistorialQueryParams,
} from "@/lib/historial-ventas";

export async function GET(req: NextRequest) {
  const usuario = getUsuarioFromRequest(req);
  if (!usuario || !isDuenoTipo(usuario.tipo_usuario)) {
    return unauthorizedError();
  }

  const sp = req.nextUrl.searchParams;
  const invalidMsg = validateHistorialQueryParams(sp);
  if (invalidMsg) {
    return validationError(invalidMsg);
  }

  const { limit, offset, fetchLimit } = parseHistorialPagination(sp);
  const { whereSql, values: whereValues } = buildHistorialVentasWhere(sp);
  const limIdx = whereValues.length + 1;
  const offIdx = whereValues.length + 2;

  const baseFrom = `
      FROM venta v
      JOIN usuario uc ON uc.id_usuario = v.id_usuario
      LEFT JOIN usuario ue ON ue.id_usuario = v.id_empleado
  `;

  const listSql = `
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
      ${baseFrom}
      LEFT JOIN detalle_venta dv ON dv.id_venta = v.id_venta
      LEFT JOIN producto p ON p.id_producto = dv.id_producto
      WHERE (${whereSql})
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
      LIMIT $${limIdx} OFFSET $${offIdx}
  `;

  try {
    const metaTotales =
      sp.get("meta_totales") === "1" || sp.get("meta_totales") === "true";

    let totales: { min_total: unknown; max_total: unknown } | undefined;
    if (metaTotales) {
      const { whereSql: whereMeta, values: valsMeta } = buildHistorialVentasWhere(
        sp,
        { omitAmountRange: true }
      );
      const metaSql = `
        SELECT
          COALESCE(MIN(v.total), 0)::numeric AS min_total,
          COALESCE(MAX(v.total), 0)::numeric AS max_total
        ${baseFrom}
        WHERE (${whereMeta})
      `;
      const metaRes = await pool.query(metaSql, valsMeta);
      const row = metaRes.rows[0] as
        | { min_total: unknown; max_total: unknown }
        | undefined;
      if (row) {
        totales = { min_total: row.min_total, max_total: row.max_total };
      }
    }

    const result = await pool.query(listSql, [
      ...whereValues,
      fetchLimit,
      offset,
    ]);

    const rows = result.rows as Record<string, unknown>[];
    const hasMore = rows.length > limit;
    const ventas = hasMore ? rows.slice(0, limit) : rows;
    const pagination = buildHistorialPaginationMeta(
      limit,
      offset,
      hasMore,
      ventas.length
    );

    const body: Record<string, unknown> = { ventas, pagination };
    if (totales !== undefined) {
      body.totales = totales;
    }

    return NextResponse.json(body);
  } catch (error) {
    return apiError("HISTORIAL_VENTAS GET", error);
  }
}
