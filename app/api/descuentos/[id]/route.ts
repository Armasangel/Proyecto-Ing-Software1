import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getUsuarioFromRequest } from "@/lib/server-auth";
import { isDuenoTipo } from "@/lib/roles";
import { apiError, unauthorizedError, validationError } from "@/lib/api-error";
import { getLogger } from "@/lib/logger";
import { validarDescuento, isTipoDescuento } from "@/lib/descuentos";

const log = getLogger("api/descuentos");

export const dynamic = "force-dynamic";

type TramoInput = { cantidad_desde: unknown; porcentaje: unknown };
type Ctx = { params: Promise<{ id: string }> };

function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * PUT /api/descuentos/[id] — edita nombre, tipo y tramos. Los tramos se
 * reemplazan (borrar + insertar) dentro de una transacción. No toca las
 * asignaciones ni el historial (detalle_venta guarda su propio snapshot).
 */
export async function PUT(req: NextRequest, ctx: Ctx) {
  const usuario = getUsuarioFromRequest(req);
  if (!usuario || !isDuenoTipo(usuario.tipo_usuario)) {
    return unauthorizedError();
  }
  const { id } = await ctx.params;
  const idDescuento = parseId(id);
  if (!idDescuento) return validationError("Descuento inválido");

  try {
    const body = await req.json();
    const { nombre, tipo, tramos } = body as {
      nombre?: unknown;
      tipo?: unknown;
      tramos?: TramoInput[];
    };

    const errorVal = validarDescuento(nombre, tipo, tramos);
    if (errorVal) return validationError(errorVal);
    const tipoFinal = isTipoDescuento(tipo) ? tipo : "PORCENTAJE";

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const upd = await client.query(
        `UPDATE descuento SET nombre = $1, tipo = $2, actualizado_en = NOW()
          WHERE id_descuento = $3 RETURNING id_descuento`,
        [(nombre as string).trim(), tipoFinal, idDescuento]
      );
      if (upd.rowCount === 0) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "Descuento no encontrado" }, { status: 404 });
      }

      await client.query(`DELETE FROM descuento_tramo WHERE id_descuento = $1`, [idDescuento]);
      for (const t of tramos!) {
        await client.query(
          `INSERT INTO descuento_tramo (id_descuento, cantidad_desde, porcentaje) VALUES ($1, $2, $3)`,
          [idDescuento, Number(t.cantidad_desde), Number(t.porcentaje)]
        );
      }
      await client.query("COMMIT");
      log.info({ id_descuento: idDescuento, usuario: usuario.id_usuario }, "Descuento editado");
      return NextResponse.json({ ok: true });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error: any) {
    if (error?.code === "23505") {
      return validationError("Ya existe un descuento con ese nombre");
    }
    return apiError("DESCUENTOS PUT", error);
  }
}

/**
 * PATCH /api/descuentos/[id] — activa o desactiva la regla. Body: { activo }.
 */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const usuario = getUsuarioFromRequest(req);
  if (!usuario || !isDuenoTipo(usuario.tipo_usuario)) {
    return unauthorizedError();
  }
  const { id } = await ctx.params;
  const idDescuento = parseId(id);
  if (!idDescuento) return validationError("Descuento inválido");

  try {
    const { activo } = await req.json();
    if (typeof activo !== "boolean") return validationError("activo debe ser true o false");

    const result = await pool.query(
      `UPDATE descuento SET activo = $1, actualizado_en = NOW() WHERE id_descuento = $2 RETURNING id_descuento`,
      [activo, idDescuento]
    );
    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Descuento no encontrado" }, { status: 404 });
    }
    log.info({ id_descuento: idDescuento, activo, usuario: usuario.id_usuario }, "Descuento activado/desactivado");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError("DESCUENTOS PATCH", error);
  }
}

/**
 * DELETE /api/descuentos/[id] — borra la regla. Sus tramos y asignaciones caen
 * en cascada; el historial de ventas conserva el snapshot y queda con
 * id_descuento NULL (ON DELETE SET NULL).
 */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const usuario = getUsuarioFromRequest(req);
  if (!usuario || !isDuenoTipo(usuario.tipo_usuario)) {
    return unauthorizedError();
  }
  const { id } = await ctx.params;
  const idDescuento = parseId(id);
  if (!idDescuento) return validationError("Descuento inválido");

  try {
    const result = await pool.query(`DELETE FROM descuento WHERE id_descuento = $1 RETURNING id_descuento`, [idDescuento]);
    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Descuento no encontrado" }, { status: 404 });
    }
    log.info({ id_descuento: idDescuento, usuario: usuario.id_usuario }, "Descuento borrado");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError("DESCUENTOS DELETE", error);
  }
}
