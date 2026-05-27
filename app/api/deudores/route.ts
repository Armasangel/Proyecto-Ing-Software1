import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getUsuarioFromRequest } from "@/lib/server-auth";
import { isStaffTipo } from "@/lib/roles";
import { apiError, unauthorizedError } from "@/lib/api-error";

export async function GET(req: NextRequest) {
  const usuario = getUsuarioFromRequest(req);
  if (!usuario || !isStaffTipo(usuario.tipo_usuario)) {
    return unauthorizedError();
  }

  const { searchParams } = req.nextUrl;
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? "50")));
  const offset = (page - 1) * limit;

  try {
    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total FROM v_deudores`
    );
    const total: number = countResult.rows[0]?.total ?? 0;

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
       ORDER BY fecha_limite_pago NULLS LAST, id_venta DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
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
