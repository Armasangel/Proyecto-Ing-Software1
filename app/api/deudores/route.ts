import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getUsuarioFromRequest } from "@/lib/server-auth";
import { isStaffTipo } from "@/lib/roles";
import { apiError, unauthorizedError } from "@/lib/api-error";
import {
  buildDeudoresOrder,
  buildDeudoresWhere,
  parseDeudoresFilters,
} from "@/lib/cobranza/deudores-query";

export async function GET(req: NextRequest) {
  const usuario = getUsuarioFromRequest(req);
  if (!usuario || !isStaffTipo(usuario.tipo_usuario)) {
    return unauthorizedError();
  }

  const filters = parseDeudoresFilters(req.nextUrl.searchParams);
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 50;
  const offset = (page - 1) * limit;

  const { where, values } = buildDeudoresWhere(filters);
  const orderSql = buildDeudoresOrder(filters);

  try {
    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total FROM v_deudores WHERE ${where}`,
      values
    );
    const total: number = countResult.rows[0]?.total ?? 0;

    const limIdx = values.length + 1;
    const offIdx = values.length + 2;

    const result = await pool.query(
      `SELECT
         id_venta,
         id_usuario,
         nombre_cliente,
         correo,
         fecha_venta,
         fecha_limite_pago,
         estado_venta,
         total_venta,
         total_pagado,
         deuda_pendiente,
         dias_atraso,
         estado_cobro
       FROM v_deudores
       WHERE ${where}
       ORDER BY ${orderSql}
       LIMIT $${limIdx} OFFSET $${offIdx}`,
      [...values, limit, offset]
    );

    return NextResponse.json({
      deudores: result.rows,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error) {
    return apiError("GET /api/deudores", error);
  }
}
