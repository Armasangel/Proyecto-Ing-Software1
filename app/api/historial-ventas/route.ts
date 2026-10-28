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
  buildHistorialVentasWhere,
  validateHistorialQueryParams,
} from "@/lib/historial-ventas";
import { parsePaginationParams, buildPaginationMeta } from "@/lib/pagination";

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

  // Unified pagination: page (1-based) + limit (clamped max).
  // Previously used ?limit&?offset; now uses ?page&?limit.
  const { page, limit } = parsePaginationParams(sp, { maxLimit: 200 });
  const offset = (page - 1) * limit;

  try {
    // Total para metadata de paginación (COUNT query).
    const { whereSql: countWhere, values: countValues } = buildHistorialVentasWhere(
      sp,
      { omitAmountRange: true }
    );
    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM venta v
       JOIN cliente uc ON uc.id_cliente = v.id_cliente
       LEFT JOIN usuario ue ON ue.id_usuario = v.id_empleado
       WHERE ${countWhere}`,
      countValues
    );
    const total: number = countResult.rows[0]?.total ?? 0;

    const meta = buildPaginationMeta(total, { page, limit, offset });

    const { whereSql, values: whereValues } = buildHistorialVentasWhere(sp);

    const listSql = `
      SELECT
        v.id_venta,
        v.id_cliente,
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
        uc.codigo_cliente,
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
              'unidad_medida', dv.unidad_base,
              'precio_unitario_venta', dv.precio_unitario,
              'subtotal', dv.subtotal
            )
            ORDER BY dv.id_detalle_venta
          ) FILTER (WHERE dv.id_detalle_venta IS NOT NULL),
          '[]'::json
        ) AS productos
      FROM venta v
      JOIN cliente uc ON uc.id_cliente = v.id_cliente
      LEFT JOIN usuario ue ON ue.id_usuario = v.id_empleado
      LEFT JOIN detalle_venta dv ON dv.id_venta = v.id_venta
      LEFT JOIN producto p ON p.id_producto = dv.id_producto
      WHERE v.id_venta IN (
        SELECT v2.id_venta
        FROM venta v2
        WHERE ${whereSql}
        ORDER BY v2.fecha_venta DESC, v2.id_venta DESC
        LIMIT $${whereValues.length + 1} OFFSET $${whereValues.length + 2}
      )
      GROUP BY
        v.id_venta,
        v.id_cliente,
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
        uc.codigo_cliente,
        ue.nombre
      ORDER BY v.fecha_venta DESC, v.id_venta DESC
    `;

    const result = await pool.query(listSql, [...whereValues, limit, offset]);

    const rows = result.rows as Record<string, unknown>[];
    const pageVentas = meta.hasMore ? rows.slice(0, limit) : rows;

    const pagination = buildPaginationMeta(total, { page, limit, offset });

    const body: Record<string, unknown> = { ventas: pageVentas, pagination };
    if (meta.total > 0) {
      // Emitir min/max total cuando el usuario pide meta_totales.
      if (sp.get("meta_totales") === "1" || sp.get("meta_totales") === "true") {
        const { whereSql: whereMeta, values: valsMeta } = buildHistorialVentasWhere(
          sp,
          { omitAmountRange: true }
        );
        const metaSql = `
          SELECT
            COALESCE(MIN(v.total), 0)::numeric AS min_total,
            COALESCE(MAX(v.total), 0)::numeric AS max_total
          FROM venta v
          JOIN cliente uc ON uc.id_cliente = v.id_cliente
          WHERE (${whereMeta})
        `;
        const metaRes = await pool.query(metaSql, valsMeta);
        const row = metaRes.rows[0];
        if (row) {
          body.totales = { min_total: row.min_total, max_total: row.max_total };
        }
      }
    }

    return NextResponse.json(body);
  } catch (error) {
    return apiError("HISTORIAL_VENTAS GET", error);
  }
}