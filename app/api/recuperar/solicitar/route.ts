// app/api/recuperar/solicitar/route.ts
//
// Paso 1 del flujo "olvidé mi contraseña": manda un código de 6 dígitos por
// correo. Aplica a cualquier tipo de usuario (DUENO, EMPLEADO, BODEGUERO).
//
// La respuesta es SIEMPRE la misma para un cuerpo válido (no importa si el
// correo existe o no) para no revelar qué correos están registrados. El detalle
// de si existía y si el correo se envió solo queda en los logs del servidor.

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { apiError, tooManyRequestsError } from "@/lib/api-error";
import { getLogger } from "@/lib/logger";
import { checkRateLimit, getClientIp } from "@/lib/api-rate-limit";
import { enviarCodigoRecuperacion } from "@/lib/mailer";
import {
  fechaExpiracion,
  generarCodigo,
  hashCodigo,
} from "@/lib/verificacion";

const log = getLogger("api/recuperar/solicitar");

// Ventana de 5 minutos. Endurecer por IP evita spam de correos desde una IP;
// endurecer por correo (pase la IP que pase) evita inundar la bandeja de un
// correo objetivo con solicitudes repetidas.
const SOLICITAR_WINDOW_MS = 5 * 60 * 1000;
const SOLICITAR_MAX_POR_IP = 5;
const SOLICITAR_MAX_POR_CORREO = 3;

const MENSAJE_OK =
  "Si el correo está registrado, te enviamos un código para recuperar tu contraseña.";

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);

    const body = await req.json();
    const correo = typeof body.correo === "string" ? body.correo.trim().toLowerCase() : "";
    if (!correo) {
      return NextResponse.json({ error: "El correo es obligatorio" }, { status: 400 });
    }

    const limiteIp = await checkRateLimit(`recuperar:solicitar:ip:${ip}`, SOLICITAR_MAX_POR_IP, SOLICITAR_WINDOW_MS);
    if (limiteIp.limited) {
      return tooManyRequestsError(limiteIp.retryAfterSeconds);
    }

    const limiteCorreo = await checkRateLimit(
      `recuperar:solicitar:correo:${correo}`,
      SOLICITAR_MAX_POR_CORREO,
      SOLICITAR_WINDOW_MS
    );
    if (limiteCorreo.limited) {
      return tooManyRequestsError(limiteCorreo.retryAfterSeconds);
    }

    const result = await pool.query<{ id_usuario: number; correo: string }>(
      `SELECT id_usuario, correo FROM usuario
       WHERE LOWER(correo) = LOWER($1) AND estado_usuario = TRUE`,
      [correo]
    );

    // Correo no registrado: responder igual que si existiera para que no se
    // pueda usar la ruta para descubrir qué cuentas existen.
    if (result.rows.length === 0) {
      log.warn({ ip, correo }, "Solicitud de recuperación para correo no registrado");
      return NextResponse.json({ ok: true, message: MENSAJE_OK });
    }

    const usuario = result.rows[0];

    const codigo = generarCodigo();
    const codigoHash = hashCodigo(codigo);
    const expiraEn = fechaExpiracion();

    await pool.query(
      `INSERT INTO codigo_recuperacion (id_usuario, codigo_hash, expira_en)
       VALUES ($1, $2, $3)`,
      [usuario.id_usuario, codigoHash, expiraEn]
    );

    try {
      await enviarCodigoRecuperacion(usuario.correo, codigo);
      log.info({ id_usuario: usuario.id_usuario, ip }, "Código de recuperación enviado por correo");
    } catch (mailError) {
      // No se revela el fallo al cliente (mantiene la respuesta genérica):
      // el código quedó guardado en la BD pero el usuario no lo va a recibir.
      // Es un problema operativo que queda registrado en los logs del server.
      log.error({ err: mailError }, "No se pudo enviar el código de recuperación");
    }

    return NextResponse.json({ ok: true, message: MENSAJE_OK });
  } catch (error) {
    return apiError("RECUPERAR SOLICITAR POST", error);
  }
}