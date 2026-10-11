// app/api/usuarios/mi-contrasena/route.ts
//
// Cambio de contraseña por el propio usuario.
//
// Antes, la ÚNICA forma de cambiar la contraseña era "olvidé mi contraseña",
// es decir que no había manera de rotarla voluntariamente: quien sospechara
// que le habían visto el dedo escribirla no tenía ninguna acción disponible.
//
// A diferencia de la recuperación por correo, acá se exige la contraseña
// actual: tener la sesión abierta no es prueba de nada, y sin ese requisito un
// token robado alcanza para fijar una contraseña permanente.

import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getUsuarioFromRequest } from "@/lib/server-auth";
import { verifyPassword } from "@/lib/auth";
import { apiError, unauthorizedError, validationError } from "@/lib/api-error";
import { checkRateLimit, getClientIp } from "@/lib/api-rate-limit";
import { claveCuenta, claveIp, clearFailedLogins } from "@/lib/login-rate-limit";
import { validarContrasena } from "@/lib/password-policy";
import { registrarAuditoria, TIPOS_EVENTO } from "@/lib/audit";
import { revocarSesiones } from "@/lib/sesion";
import { enviarAvisoCambioContrasena } from "@/lib/mailer";
import { getLogger } from "@/lib/logger";

const log = getLogger("api/usuarios/mi-contrasena");

const VENTANA_MS = 15 * 60_000;
const MAX_POR_USUARIO = 5;

export async function PATCH(req: NextRequest) {
  try {
    const usuario = getUsuarioFromRequest(req);
    if (!usuario) {
      return unauthorizedError();
    }

    const limite = await checkRateLimit(
      `mi-contrasena:${usuario.id_usuario}`,
      MAX_POR_USUARIO,
      VENTANA_MS
    );
    if (limite.limited) {
      return NextResponse.json(
        { error: "Demasiados intentos. Intentá de nuevo en unos minutos." },
        { status: 429, headers: { "Retry-After": String(limite.retryAfterSeconds) } }
      );
    }

    const body = await req.json();
    const contrasenaActual = typeof body.contrasena_actual === "string" ? body.contrasena_actual : "";
    const nuevaContrasena = typeof body.nueva_contrasena === "string" ? body.nueva_contrasena : "";

    if (!contrasenaActual || !nuevaContrasena) {
      return validationError("La contraseña actual y la nueva son obligatorias");
    }

    const errorContrasena = validarContrasena(nuevaContrasena);
    if (errorContrasena) {
      return validationError(errorContrasena);
    }

    // El hash vigente se relee de la base, no del token: la contraseña nunca
    // viaja en el JWT.
    const fila = await pool.query<{ correo: string; nombre: string; contrasena_hash: string }>(
      `SELECT correo, nombre, contrasena_hash
         FROM usuario
        WHERE id_usuario = $1 AND estado_usuario = TRUE`,
      [usuario.id_usuario]
    );

    if (fila.rowCount === 0) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    if (!verifyPassword(contrasenaActual, fila.rows[0].contrasena_hash)) {
      registrarAuditoria({
        id_usuario: usuario.id_usuario,
        correo: fila.rows[0].correo,
        // Evento propio, no un PASSWORD_CAMBIO con resultado "rechazado": en
        // el panel un cambio de contraseña debe decir SIEMPRE que la
        // contraseña se cambió.
        tipo_evento: TIPOS_EVENTO.PASSWORD_CAMBIO_RECHAZADO,
        ip: getClientIp(req),
        user_agent: req.headers.get("user-agent"),
        detalle: { motivo: "contrasena_actual_incorrecta", via: "mi_cuenta" },
      });

      // No se registra la contraseña nueva ni su hash, sólo que el intento
      // falló: la bitácora dice QUÉ pasó, nunca CON QUÉ clave.
      return NextResponse.json(
        { error: "La contraseña actual no es correcta" },
        { status: 401 }
      );
    }

    if (verifyPassword(nuevaContrasena, fila.rows[0].contrasena_hash)) {
      return validationError("La nueva contraseña debe ser distinta de la actual");
    }

    const hash = bcrypt.hashSync(nuevaContrasena, 10);

    await pool.query(
      `UPDATE usuario
          SET contrasena_hash = $1,
              requiere_cambio_contrasena = FALSE,
              sesion_version = sesion_version + 1
        WHERE id_usuario = $2`,
      [hash, usuario.id_usuario]
    );

    // Las sesiones del propio usuario también caen: si el cambio viene de un
    // dispositivo comprometido, dejar vivo ese token sería el hueco entero.
    const ip = getClientIp(req);
    await clearFailedLogins(claveIp(ip));
    await clearFailedLogins(claveCuenta(fila.rows[0].correo));
    await revocarSesiones(usuario.id_usuario);

    registrarAuditoria({
      id_usuario: usuario.id_usuario,
      correo: fila.rows[0].correo,
      tipo_evento: TIPOS_EVENTO.PASSWORD_CAMBIO,
      ip,
      user_agent: req.headers.get("user-agent"),
      detalle: { resultado: "aceptado", via: "mi_cuenta", sesiones_revocadas: true },
    });

    try {
      await enviarAvisoCambioContrasena(fila.rows[0].correo, fila.rows[0].nombre, ip);
    } catch (mailError) {
      // El cambio ya está aplicado; fallar el aviso no debe reportar un 500.
      log.error({ err: mailError, id_usuario: usuario.id_usuario }, "No se pudo enviar el aviso de cambio de contraseña");
    }

    return NextResponse.json({
      ok: true,
      mensaje:
        "Tu contraseña fue cambiada y se cerraron todas tus sesiones. Volvé a iniciar sesión.",
    });
  } catch (error) {
    return apiError("USUARIOS MI-CONTRASENA PATCH", error);
  }
}