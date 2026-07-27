import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getUsuarioFromRequest } from "@/lib/server-auth";
import { isStaffTipo } from "@/lib/roles";
import { apiError, unauthorizedError, validationError } from "@/lib/api-error";

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

  try {
    const actual = await pool.query(
      `SELECT estado_deuda FROM deuda WHERE id_deuda = $1`,
      [id_deuda]
    );
    if (actual.rows.length === 0) {
      return validationError("La deuda no existe");
    }

    const nuevoEstado =
      actual.rows[0].estado_deuda === "PENDIENTE" ? "PAGADA" : "PENDIENTE";

    const result = await pool.query(
      `UPDATE deuda SET estado_deuda = $1 WHERE id_deuda = $2 RETURNING *`,
      [nuevoEstado, id_deuda]
    );

    return NextResponse.json({ deuda: result.rows[0] });
  } catch (error) {
    return apiError("DEUDAS PATCH", error);
  }
}
