import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getUsuarioFromRequest } from "@/lib/server-auth";
import { isDuenoTipo } from "@/lib/roles";
import { apiError, unauthorizedError, validationError } from "@/lib/api-error";

/**
 * DELETE /api/presentaciones/[id]
 * Desactiva una presentación (soft-delete: el kardex histórico la sigue
 * referenciando). Solo el dueño administra el catálogo de presentaciones.
 */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const usuario = getUsuarioFromRequest(req);
  if (!usuario || !isDuenoTipo(usuario.tipo_usuario)) {
    return unauthorizedError();
  }

  const idPresentacion = Number(params.id);
  if (!idPresentacion) {
    return validationError("id de presentación inválido");
  }

  try {
    const result = await pool.query(
      `UPDATE presentacion_producto SET estado_presentacion = FALSE WHERE id_presentacion = $1
       RETURNING id_presentacion`,
      [idPresentacion]
    );
    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Presentación no encontrada" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError("PRESENTACIONES DELETE", error);
  }
}
