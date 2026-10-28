import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getUsuarioFromRequest } from "@/lib/server-auth";
import { isStaffTipo } from "@/lib/roles";
import { apiError, unauthorizedError, validationError } from "@/lib/api-error";
import { cargarDescuentosAplicables } from "@/lib/descuentos";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

/**
 * GET /api/descuentos/aplicables?id_cliente=N — reglas de descuento activas
 * que le corresponden a ese cliente (por cliente o por su tipo_cliente), con
 * sus tramos. La pantalla de Ventas las usa para PREVISUALIZAR el descuento;
 * el cálculo real lo hace el servidor al registrar la venta.
 *
 * Lo consulta cualquier staff (dueño o colaborador), no solo el dueño.
 */
export async function GET(req: NextRequest) {
  const usuario = getUsuarioFromRequest(req);
  if (!usuario || !isStaffTipo(usuario.tipo_usuario)) {
    return unauthorizedError();
  }

  const idCliente = Number(req.nextUrl.searchParams.get("id_cliente"));
  if (!Number.isInteger(idCliente) || idCliente < 1) {
    return validationError("id_cliente inválido");
  }

  try {
    const clienteRes = await pool.query(
      `SELECT tipo_cliente FROM cliente WHERE id_cliente = $1 AND estado_cliente = TRUE`,
      [idCliente]
    );
    if (clienteRes.rowCount === 0) {
      return validationError("Cliente no encontrado");
    }
    const tipoCliente = clienteRes.rows[0].tipo_cliente as string;

    const descuentos = await cargarDescuentosAplicables(pool, idCliente, tipoCliente);
    return NextResponse.json({ descuentos }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError("DESCUENTOS APLICABLES GET", error);
  }
}
