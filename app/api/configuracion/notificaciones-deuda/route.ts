// app/api/configuracion/notificaciones-deuda/route.ts
//
// GET: cualquier usuario staff puede ver la configuración actual (activo /
// intervalo_dias). PATCH: solo el dueño puede cambiarla — es él quien decide
// cada cuánto se le recuerda a los clientes su deuda pendiente.
import { NextRequest, NextResponse } from "next/server";
import { getUsuarioFromRequest } from "@/lib/server-auth";
import { isStaffTipo, TIPOS_USUARIO } from "@/lib/roles";
import { apiError, unauthorizedError, validationError } from "@/lib/api-error";
import { actualizarConfiguracion, obtenerConfiguracion } from "@/lib/notificaciones-deuda";

const INTERVALO_MIN_DIAS = 1;
const INTERVALO_MAX_DIAS = 365;

export async function GET(req: NextRequest) {
  const usuario = getUsuarioFromRequest(req);
  if (!usuario || !isStaffTipo(usuario.tipo_usuario)) {
    return unauthorizedError();
  }

  try {
    const config = await obtenerConfiguracion();
    return NextResponse.json({ configuracion: config });
  } catch (error) {
    return apiError("CONFIGURACION NOTIFICACIONES-DEUDA GET", error);
  }
}

export async function PATCH(req: NextRequest) {
  const usuario = getUsuarioFromRequest(req);
  if (!usuario || usuario.tipo_usuario !== TIPOS_USUARIO.DUENO) {
    return unauthorizedError();
  }

  try {
    const body = await req.json();
    const cambios: { activo?: boolean; intervalo_dias?: number } = {};

    if (body.activo !== undefined) {
      if (typeof body.activo !== "boolean") {
        return validationError("activo debe ser true o false");
      }
      cambios.activo = body.activo;
    }

    if (body.intervalo_dias !== undefined) {
      const intervalo = Number(body.intervalo_dias);
      if (
        !Number.isInteger(intervalo) ||
        intervalo < INTERVALO_MIN_DIAS ||
        intervalo > INTERVALO_MAX_DIAS
      ) {
        return validationError(
          `intervalo_dias debe ser un número entero entre ${INTERVALO_MIN_DIAS} y ${INTERVALO_MAX_DIAS}`
        );
      }
      cambios.intervalo_dias = intervalo;
    }

    if (Object.keys(cambios).length === 0) {
      return validationError("No se envió ningún cambio (activo y/o intervalo_dias)");
    }

    const config = await actualizarConfiguracion(cambios, usuario.id_usuario);
    return NextResponse.json({ configuracion: config });
  } catch (error) {
    return apiError("CONFIGURACION NOTIFICACIONES-DEUDA PATCH", error);
  }
}
