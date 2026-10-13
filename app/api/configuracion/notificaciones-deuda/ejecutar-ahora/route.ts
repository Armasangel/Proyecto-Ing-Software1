// app/api/configuracion/notificaciones-deuda/ejecutar-ahora/route.ts
//
// El dueño puede forzar una corrida inmediata del job de notificaciones
// (sin esperar al chequeo automático por hora) — útil para probarlo o para
// un envío urgente. Sigue respetando la configuración: si activo=false, no
// manda nada (mismo comportamiento que el scheduler automático).
import { NextRequest, NextResponse } from "next/server";
import { getUsuarioFromRequest } from "@/lib/server-auth";
import { TIPOS_USUARIO } from "@/lib/roles";
import { apiError, tooManyRequestsError, unauthorizedError } from "@/lib/api-error";
import { checkRateLimit, getClientIp } from "@/lib/api-rate-limit";
import { ejecutarNotificacionesDeuda } from "@/lib/notificaciones-deuda";

export async function POST(req: NextRequest) {
  // Cada corrida puede mandar correos reales a varios clientes — un límite
  // bajo evita que alguien la dispare en bucle sin querer (doble clic, etc.).
  const rl = await checkRateLimit(`notificaciones-deuda:ejecutar-ahora:${getClientIp(req)}`, 3, 60_000);
  if (rl.limited) return tooManyRequestsError(rl.retryAfterSeconds);

  const usuario = getUsuarioFromRequest(req);
  if (!usuario || usuario.tipo_usuario !== TIPOS_USUARIO.DUENO) {
    return unauthorizedError();
  }

  try {
    const resumen = await ejecutarNotificacionesDeuda();
    return NextResponse.json(resumen);
  } catch (error) {
    return apiError("CONFIGURACION NOTIFICACIONES-DEUDA EJECUTAR-AHORA POST", error);
  }
}
