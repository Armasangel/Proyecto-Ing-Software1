import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getUsuarioFromRequest } from "@/lib/server-auth";
import { isStaffTipo } from "@/lib/roles";
import { apiError, unauthorizedError } from "@/lib/api-error";

// Mismo criterio que /api/clientes: nunca servir cacheado, porque un cliente
// puede bloquearse por deuda en cualquier momento.
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const LIMITE_POR_DEFECTO = 5;
const LIMITE_MAXIMO = 20;
const VENTANA_DIAS = 180;

/**
 * GET /api/clientes/frecuentes?limit=5
 * Clientes ACTIVOS que más órdenes han hecho en los últimos 180 días
 * (sin contar canceladas). Se usa en Órdenes para sugerir clientes antes de
 * que el colaborador escriba nada. Si hay empate (o nadie tiene órdenes
 * todavía), desempata por la orden más reciente y luego por nombre, así la
 * lista no cambia sola cada vez que se consulta.
 */
export async function GET(req: NextRequest) {
  const usuario = getUsuarioFromRequest(req);
  if (!usuario || !isStaffTipo(usuario.tipo_usuario)) {
    return unauthorizedError();
  }

  const limiteParam = Number(req.nextUrl.searchParams.get("limit"));
  const limite =
    Number.isInteger(limiteParam) && limiteParam >= 1
      ? Math.min(limiteParam, LIMITE_MAXIMO)
      : LIMITE_POR_DEFECTO;

  try {
    const result = await pool.query(
      `SELECT c.id_cliente, c.nombre, c.correo, c.telefono, c.tipo_cliente,
              c.estado_cliente, c.limite_deuda,
              COUNT(o.id_orden)::int AS total_ordenes
         FROM cliente c
         LEFT JOIN orden o
           ON o.id_cliente = c.id_cliente
          AND o.estado <> 'CANCELADO'
          AND o.fecha_orden >= NOW() - ($2::int * INTERVAL '1 day')
        WHERE c.estado_cliente = TRUE
        GROUP BY c.id_cliente
        ORDER BY total_ordenes DESC, MAX(o.fecha_orden) DESC NULLS LAST, c.nombre
        LIMIT $1`,
      [limite, VENTANA_DIAS]
    );
    return NextResponse.json(
      { clientes: result.rows },
      { headers: { "Cache-Control": "no-store, must-revalidate" } }
    );
  } catch (error) {
    return apiError("CLIENTES FRECUENTES GET", error);
  }
}
