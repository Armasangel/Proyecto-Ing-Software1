import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getUsuarioFromRequest } from "@/lib/server-auth";
import { isStaffTipo } from "@/lib/roles";
import { apiError, unauthorizedError, validationError } from "@/lib/api-error";
import { recalcularBloqueoCliente } from "@/lib/deuda-alertas";

// PATCH /api/deudas/:id — cambia el estado de la deuda (PENDIENTE <-> PAGADA)
// Este es el endpoint del botonCambioEstado (DEV-81).
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const usuario = getUsuarioFromRequest(req);
  if (!usuario || !isStaffTipo(usuario.tipo_usuario)) {
    return unauthorizedError();
  }

  const id_deuda = Number(params.id);
  if (!Number.isInteger(id_deuda)) {
    return validationError("Id de deuda inválido");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const actual = await client.query(
      `SELECT estado_deuda, id_cliente FROM deuda WHERE id_deuda = $1 FOR UPDATE`,
      [id_deuda]
    );
    if (actual.rows.length === 0) {
      await client.query("ROLLBACK");
      return validationError("La deuda no existe");
    }

    const nuevoEstado =
      actual.rows[0].estado_deuda === "PENDIENTE" ? "PAGADA" : "PENDIENTE";
    const idCliente: number | null = actual.rows[0].id_cliente;

    const result = await client.query(
      `UPDATE deuda SET estado_deuda = $1 WHERE id_deuda = $2 RETURNING *`,
      [nuevoEstado, id_deuda]
    );

    // Si la deuda estaba vinculada a un cliente, pagarla o reabrirla puede
    // cambiar su deuda pendiente total y por lo tanto su bloqueo.
    let alerta: Awaited<ReturnType<typeof recalcularBloqueoCliente>> | null = null;
    if (idCliente !== null) {
      alerta = await recalcularBloqueoCliente(client, idCliente);
    }

    await client.query("COMMIT");
    return NextResponse.json({ deuda: result.rows[0], alerta });
  } catch (error) {
    await client.query("ROLLBACK");
    return apiError("DEUDAS PATCH", error);
  } finally {
    client.release();
  }
}