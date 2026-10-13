// app/api/usuarios/limites/route.ts
//
// GET: cupo de cada tipo de usuario (límite configurado y activos hoy), para
// la pestaña de Usuarios. Cambiar un límite NO se hace acá: pasa por
// /limites/solicitar + /limites/confirmar (verificación en 2 pasos).
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getUsuarioFromRequest } from "@/lib/server-auth";
import { isDuenoTipo } from "@/lib/roles";
import { apiError, tooManyRequestsError, unauthorizedError } from "@/lib/api-error";
import { checkRateLimit, getClientIp } from "@/lib/api-rate-limit";
import { leerTodosLosCupos } from "@/lib/limites-usuarios";

export async function GET(req: NextRequest) {
  const rl = await checkRateLimit(`usuarios-limites:GET:${getClientIp(req)}`, 60, 60_000);
  if (rl.limited) return tooManyRequestsError(rl.retryAfterSeconds);

  const usuario = getUsuarioFromRequest(req);
  if (!usuario || !isDuenoTipo(usuario.tipo_usuario)) {
    return unauthorizedError();
  }

  try {
    const limites = await leerTodosLosCupos(pool);
    return NextResponse.json({ limites });
  } catch (error) {
    return apiError("USUARIOS LIMITES GET", error);
  }
}
