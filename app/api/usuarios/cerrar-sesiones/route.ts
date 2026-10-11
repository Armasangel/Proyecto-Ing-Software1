// app/api/usuarios/cerrar-sesiones/route.ts
//
// Cierra TODAS las sesiones abiertas de un usuario.
//
// Sube usuario.sesion_version, y como cada JWT lleva ese valor como claim `sv`,
// todos los tokens emitidos hasta ese momento dejan de servir de inmediato
// (ver lib/sesion.ts). Es la respuesta al escenario "me robaron la contraseña
// en el celular y no quiero esperar a que expire el token".
//
// Dos usos:
//   · el propio usuario cierra sus otros dispositivos  → POST /api/usuarios/mi-sesiones/cerrar
//   · el dueño cierra las sesiones de un colaborador  → este endpoint

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getUsuarioFromRequest } from "@/lib/server-auth";
import { isDuenoTipo } from "@/lib/roles";
import { apiError, unauthorizedError, validationError } from "@/lib/api-error";
import { checkRateLimit, getClientIp } from "@/lib/api-rate-limit";
import { getLogger } from "@/lib/logger";

const log = getLogger("api/usuarios/cerrar-sesiones");

export async function POST(req: NextRequest) {
  try {
    const usuario = getUsuarioFromRequest(req);
    if (!usuario || !isDuenoTipo(usuario.tipo_usuario)) {
      return unauthorizedError();
    }

    const limite = await checkRateLimit(
      `cerrar-sesiones:${usuario.id_usuario}`,
      20,
      60_000
    );
    if (limite.limited) {
      return NextResponse.json(
        { error: "Demasiadas solicitudes. Intentá de nuevo en un momento." },
        { status: 429, headers: { "Retry-After": String(limite.retryAfterSeconds) } }
      );
    }

    const body = await req.json();
    const idObjetivo = Number(body.id_usuario);
    if (!idObjetivo || idObjetivo < 1) {
      return validationError("id_usuario inválido");
    }

    // Evitar un auto-bloqueo accidental desde el panel: para cerrar las
    // sesiones del propio dueño está el endpoint de /mi-cuenta.
    if (idObjetivo === usuario.id_usuario) {
      return validationError(
        "Para cerrar tus propias sesiones usá tu página de cuenta (/mi-cuenta)"
      );
    }

    const resultado = await pool.query<{ id_usuario: number; correo: string }>(
      `UPDATE usuario
          SET sesion_version = sesion_version + 1
        WHERE id_usuario = $1
      RETURNING id_usuario, correo`,
      [idObjetivo]
    );

    if (resultado.rowCount === 0) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    log.info(
      {
        id_usuario: idObjetivo,
        actor: usuario.id_usuario,
        ip: getClientIp(req),
      },
      "Sesiones del usuario revocadas por el dueño"
    );

    return NextResponse.json({
      ok: true,
      mensaje: `Se cerraron todas las sesiones de ${resultado.rows[0].correo}`,
    });
  } catch (error) {
    return apiError("USUARIOS CERRAR-SESIONES POST", error);
  }
}