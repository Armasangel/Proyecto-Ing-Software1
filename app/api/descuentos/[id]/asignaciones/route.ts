import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getUsuarioFromRequest } from "@/lib/server-auth";
import { isDuenoTipo } from "@/lib/roles";
import { apiError, unauthorizedError, validationError } from "@/lib/api-error";
import { getLogger } from "@/lib/logger";
import { validarAsignacion } from "@/lib/descuentos";

const log = getLogger("api/descuentos");

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * POST /api/descuentos/[id]/asignaciones — asigna la regla a un cliente
 * puntual o a un tipo de cliente. Body: { id_cliente } | { tipo_cliente }.
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  const usuario = getUsuarioFromRequest(req);
  if (!usuario || !isDuenoTipo(usuario.tipo_usuario)) {
    return unauthorizedError();
  }
  const { id } = await ctx.params;
  const idDescuento = parseId(id);
  if (!idDescuento) return validationError("Descuento inválido");

  try {
    const body = await req.json();
    const { id_cliente, tipo_cliente } = body ?? {};
    const errorVal = validarAsignacion(id_cliente, tipo_cliente);
    if (errorVal) return validationError(errorVal);

    const regla = await pool.query(`SELECT 1 FROM descuento WHERE id_descuento = $1`, [idDescuento]);
    if (regla.rowCount === 0) {
      return NextResponse.json({ error: "Descuento no encontrado" }, { status: 404 });
    }

    const result = await pool.query(
      `INSERT INTO descuento_asignacion (id_descuento, id_cliente, tipo_cliente)
       VALUES ($1, $2, $3) RETURNING id_asignacion`,
      [
        idDescuento,
        id_cliente != null && String(id_cliente).trim() !== "" ? Number(id_cliente) : null,
        tipo_cliente != null && String(tipo_cliente).trim() !== "" ? tipo_cliente : null,
      ]
    );
    log.info({ id_descuento: idDescuento, id_asignacion: result.rows[0].id_asignacion, usuario: usuario.id_usuario }, "Asignación creada");
    return NextResponse.json({ id_asignacion: result.rows[0].id_asignacion }, { status: 201 });
  } catch (error) {
    return apiError("DESCUENTOS ASIGNACIONES POST", error);
  }
}

/**
 * DELETE /api/descuentos/[id]/asignaciones?id_asignacion=N — quita una
 * asignación puntual de la regla.
 */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const usuario = getUsuarioFromRequest(req);
  if (!usuario || !isDuenoTipo(usuario.tipo_usuario)) {
    return unauthorizedError();
  }
  const { id } = await ctx.params;
  const idDescuento = parseId(id);
  if (!idDescuento) return validationError("Descuento inválido");

  const idAsignacion = parseId(req.nextUrl.searchParams.get("id_asignacion") ?? "");
  if (!idAsignacion) return validationError("Falta id_asignacion");

  try {
    const result = await pool.query(
      `DELETE FROM descuento_asignacion WHERE id_asignacion = $1 AND id_descuento = $2 RETURNING id_asignacion`,
      [idAsignacion, idDescuento]
    );
    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Asignación no encontrada" }, { status: 404 });
    }
    log.info({ id_descuento: idDescuento, id_asignacion: idAsignacion, usuario: usuario.id_usuario }, "Asignación eliminada");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError("DESCUENTOS ASIGNACIONES DELETE", error);
  }
}
