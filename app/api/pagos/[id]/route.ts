import { NextRequest, NextResponse } from "next/server";
import { getUsuarioFromRequest } from "@/lib/server-auth";
import { isStaffTipo } from "@/lib/roles";
import { pool } from "@/lib/db";
import {
  apiError,
  unauthorizedError,
  validationError,
} from "@/lib/api-error";
import { actualizarPago } from "@/lib/cobranza/pagos";

type RouteContext = { params: { id: string } };

export async function PUT(req: NextRequest, { params }: RouteContext) {
  const usuario = getUsuarioFromRequest(req);
  if (!usuario || !isStaffTipo(usuario.tipo_usuario)) {
    return unauthorizedError();
  }

  const id_pago = Number(params.id);
  if (!Number.isFinite(id_pago) || id_pago <= 0) {
    return validationError("id de pago inválido");
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return validationError("JSON inválido");
  }

  if (!body || typeof body !== "object") {
    return validationError("Cuerpo inválido");
  }

  const { monto } = body as Record<string, unknown>;
  if (monto == null || !Number.isFinite(Number(monto)) || Number(monto) <= 0) {
    return validationError("monto debe ser mayor a 0");
  }

  try {
    const result = await actualizarPago(pool, id_pago, Number(monto));

    return NextResponse.json({
      ok: true,
      id_venta: result.id_venta,
      deuda_pendiente: result.deuda_pendiente,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "PAGO_NOT_FOUND") {
        return validationError("Pago no encontrado");
      }
      if (error.message === "VENTA_NOT_FOUND") {
        return validationError("Venta no encontrada");
      }
      if (error.message === "MONTO_EXCEDE_DEUDA") {
        return validationError("El monto supera el total de la venta");
      }
    }
    return apiError("PUT /api/pagos/[id]", error);
  }
}
