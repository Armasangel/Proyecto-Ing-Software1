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

  const top = Math.min(10, Math.max(1, Number(req.nextUrl.searchParams.get("top") ?? "5")));

  try {
    const resumen = await pool.query(`
      SELECT
        COUNT(*)::int AS deudas_activas,
        COUNT(*) FILTER (WHERE estado_cobro = 'CRITICO')::int AS deudas_criticas,
        COUNT(*) FILTER (WHERE estado_cobro = 'VENCIDO')::int AS deudas_vencidas,
        COALESCE(SUM(deuda_pendiente), 0)::float8 AS total_adeudado
      FROM v_deudores
    `);

    const porCliente = await pool.query(
      `SELECT
         id_usuario,
         nombre_cliente,
         COUNT(*)::int AS cantidad_deudas,
         SUM(deuda_pendiente)::float8 AS total_adeudado
       FROM v_deudores
       GROUP BY id_usuario, nombre_cliente
       ORDER BY total_adeudado DESC
       LIMIT $1`,
      [top]
    );

    const row = resumen.rows[0];

    return NextResponse.json({
      resumen: {
        deudas_activas: row?.deudas_activas ?? 0,
        deudas_criticas: row?.deudas_criticas ?? 0,
        deudas_vencidas: row?.deudas_vencidas ?? 0,
        total_adeudado: Number(row?.total_adeudado ?? 0),
      },
      por_cliente: porCliente.rows.map((r) => ({
        id_usuario: r.id_usuario,
        nombre_cliente: r.nombre_cliente,
        cantidad_deudas: r.cantidad_deudas,
        total_adeudado: Number(r.total_adeudado),
      })),
    });
  } catch (error) {
    return apiError("GET /api/deudores/resumen", error);
  }
}
