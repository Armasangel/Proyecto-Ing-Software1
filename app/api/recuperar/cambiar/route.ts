// app/api/recuperar/cambiar/route.ts
//
// Paso 3 del flujo "olvidé mi contraseña": con el reset_token obtenido en el
// paso 2, escribe la nueva contraseña. Al cambiar, se invalidan los códigos de
// 2FA y de recuperación pendientes del usuario, y se limpia el bloqueo de
// intentos fallidos de login del IP para que pueda entrar con la clave nueva.

import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { apiError, tooManyRequestsError, validationError } from "@/lib/api-error";
import { getLogger } from "@/lib/logger";
import { checkRateLimit, getClientIp } from "@/lib/api-rate-limit";
import { clearFailedLogins } from "@/lib/login-rate-limit";
import { verifyResetToken } from "@/lib/verificacion";

const log = getLogger("api/recuperar/cambiar");

const CAMBIAR_WINDOW_MS = 5 * 60 * 1000;
const CAMBIAR_MAX_POR_IP = 5;
const CONTRASENA_MIN_LENGTH = 6;

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);

    const limite = await checkRateLimit(`recuperar:cambiar:ip:${ip}`, CAMBIAR_MAX_POR_IP, CAMBIAR_WINDOW_MS);
    if (limite.limited) {
      return tooManyRequestsError(limite.retryAfterSeconds);
    }

    const body = await req.json();
    const resetToken = typeof body.reset_token === "string" ? body.reset_token : "";
    const nuevaContrasena = typeof body.nueva_contrasena === "string" ? body.nueva_contrasena : "";

    if (!resetToken || !nuevaContrasena) {
      return validationError("El token y la nueva contraseña son obligatorios");
    }

    if (nuevaContrasena.length < CONTRASENA_MIN_LENGTH) {
      return validationError("La contraseña debe tener al menos 6 caracteres");
    }

    const idUsuario = verifyResetToken(resetToken);
    if (!idUsuario) {
      log.warn({ ip }, "Token de recuperación inválido o vencido");
      return NextResponse.json(
        { error: "La sesión de recuperación expiró. Repetí el proceso desde el correo." },
        { status: 401 }
      );
    }

    const usuarioResult = await pool.query<{ id_usuario: number }>(
      `SELECT id_usuario FROM usuario WHERE id_usuario = $1 AND estado_usuario = TRUE`,
      [idUsuario]
    );

    if (usuarioResult.rows.length === 0) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    const hash = bcrypt.hashSync(nuevaContrasena, 10);

    const actualizado = await pool.query(
      `UPDATE usuario SET contrasena_hash = $1 WHERE id_usuario = $2`,
      [hash, idUsuario]
    );

    if (actualizado.rowCount === 0) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    // La contraseña cambió: ningún código pendiente tiene sentido. Se invalidan
    // los de recuperación y los de 2FA (por si este usuario tenía un login a
    // medio completar). También se limpia el bloqueo de login del IP actual
    // para que el usuario pueda entrar de inmediato con la contraseña nueva.
    await pool.query(`DELETE FROM codigo_recuperacion WHERE id_usuario = $1`, [idUsuario]);
    await pool.query(`DELETE FROM codigo_verificacion WHERE id_usuario = $1`, [idUsuario]);
    await clearFailedLogins(ip);

    log.info({ id_usuario: idUsuario, ip }, "Contraseña restablecida correctamente");

    return NextResponse.json({
      ok: true,
      message: "Contraseña actualizada. Iniciá sesión con tu contraseña nueva.",
    });
  } catch (error) {
    return apiError("RECUPERAR CAMBIAR POST", error);
  }
}