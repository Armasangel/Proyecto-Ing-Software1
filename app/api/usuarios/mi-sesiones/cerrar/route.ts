// app/api/usuarios/mi-sesiones/cerrar/route.ts
//
// El propio usuario cierra sus sesiones abiertas en otros dispositivos.
//
// Subir usuario.sesion_version invalida todos los tokens emitidos hasta ahora,
// incluido el de esta misma petición: por eso la respuesta además borra la
// cookie y el cliente tiene que volver a iniciar sesión. Es el comportamiento
// esperable de "salir de todas partes".

import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE } from "@/lib/auth";
import { getUsuarioFromRequest } from "@/lib/server-auth";
import { apiError, unauthorizedError } from "@/lib/api-error";
import { registrarAuditoria, TIPOS_EVENTO } from "@/lib/audit";
import { revocarSesiones } from "@/lib/sesion";
import { getLogger } from "@/lib/logger";
import { getClientIp } from "@/lib/client-ip";

const log = getLogger("api/usuarios/mi-sesiones/cerrar");

export async function POST(req: NextRequest) {
  try {
    const usuario = getUsuarioFromRequest(req);
    if (!usuario) {
      return unauthorizedError();
    }

    await revocarSesiones(usuario.id_usuario);

    registrarAuditoria({
      id_usuario: usuario.id_usuario,
      correo: usuario.correo,
      tipo_evento: TIPOS_EVENTO.SESIONES_REVOCADAS,
      ip: getClientIp(req),
      user_agent: req.headers.get("user-agent"),
      detalle: { alcance: "propias_sesiones", propio_usuario: true },
    });

    log.info({ id_usuario: usuario.id_usuario }, "El usuario cerró sus propias sesiones");

    const res = NextResponse.json({
      ok: true,
      mensaje: "Se cerraron todas tus sesiones. Volvé a iniciar sesión.",
    });

    // Esta respuesta ya llega con la sesión invalidada: se limpia la cookie
    // para que el cliente no siga enviando un token muerto.
    res.cookies.set(AUTH_COOKIE, "", { path: "/", maxAge: 0 });

    return res;
  } catch (error) {
    return apiError("USUARIOS MI-SESIONES/CERRAR POST", error);
  }
}