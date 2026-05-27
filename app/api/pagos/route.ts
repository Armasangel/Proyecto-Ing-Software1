import { NextRequest, NextResponse } from "next/server";
import { getUsuarioFromRequest } from "@/lib/server-auth";
import { isStaffTipo } from "@/lib/roles";
import { pool } from "@/lib/db";
import {
  apiError,
  unauthorizedError,
  validationError,
} from "@/lib/api-error";
import {
  isMetodoPago,
  registrarPago,
} from "@/lib/cobranza/pagos";

export async function POST(req: NextRequest) {
  const usuario = getUsuarioFromRequest(req);
  if (!usuario || !isStaffTipo(usuario.tipo_usuario)) {
    return unauthorizedError();
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

  const { id_venta, monto, metodo } = body as Record<string, unknown>;

  if (id_venta == null || !Number.isFinite(Number(id_venta))) {
    return validationError("id_venta es requerido");
  }
  if (monto == null || !Number.isFinite(Number(monto)) || Number(monto) <= 0) {
    return validationError("monto debe ser mayor a 0");
  }
  if (typeof metodo !== "string" || !isMetodoPago(metodo)) {
    return validationError("metodo inválido (TARJETA, EFECTIVO o TRANSFERENCIA)");
  }

  try {
    const result = await registrarPago(pool, {
      id_venta: Number(id_venta),
      monto: Number(monto),
      metodo,
    });

    return NextResponse.json(
      {
        ok: true,
        id_pago: result.id_pago,
        deuda_pendiente: result.deuda_pendiente,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "VENTA_NOT_FOUND") {
        return validationError("Venta no encontrada");
      }
      if (error.message === "MONTO_EXCEDE_DEUDA") {
        return validationError("El monto supera el saldo pendiente");
      }
    }
    return apiError("POST /api/pagos", error);
  }
}
