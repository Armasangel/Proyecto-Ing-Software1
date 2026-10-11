// app/api/login/verificar-codigo/route.ts
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { AUTH_COOKIE, authCookieOptions, signAuthToken } from "@/lib/auth";
import { apiError } from "@/lib/api-error";
import { getLogger } from "@/lib/logger";
import { checkRateLimit, getClientIp } from "@/lib/api-rate-limit";
import { compararCodigo, getMaxIntentos, verifyPreToken } from "@/lib/verificacion";
import { registrarAuditoria, TIPOS_EVENTO } from "@/lib/audit";

const log = getLogger("api/login/verificar-codigo");

// Límite sobre el endpoint de 2FA. El contador de intentos por código
// (5) no alcanzaba: basta con pedir un código nuevo para volver a cero.
const LIMITE_2FA_MAX = 5;
const LIMITE_2FA_VENTANA_MS = 5 * 60_000;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const preToken = typeof body.pre_token === "string" ? body.pre_token : "";
    const codigo = typeof body.codigo === "string" ? body.codigo.trim() : "";

    if (!preToken || !codigo) {
      return NextResponse.json(
        { error: "Faltan datos para verificar el código" },
        { status: 400 }
      );
    }

    const idUsuario = verifyPreToken(preToken);
    if (!idUsuario) {
      log.warn({}, "Pre-token de verificación inválido o vencido");
      return NextResponse.json(
        { error: "La sesión de verificación expiró. Iniciá sesión de nuevo." },
        { status: 401 }
      );
    }

    // Doble límite: por IP y por cuenta. El de IP frena a quien prueba
    // códigos en serie; el de cuenta frena a quien reparte los intentos entre
    // varias IP (el código es de 6 dígitos: sólo 10^6 combinaciones).
    const ip = getClientIp(req);
    const limites = await Promise.all([
      checkRateLimit(`login2fa:ip:${ip}`, LIMITE_2FA_MAX, LIMITE_2FA_VENTANA_MS),
      checkRateLimit(`login2fa:acct:${idUsuario}`, LIMITE_2FA_MAX, LIMITE_2FA_VENTANA_MS),
    ]);

    if (limites.some((limite) => limite.limited)) {
      log.warn({ id_usuario: idUsuario, ip }, "Verificación de 2FA bloqueada por rate limit");
      return NextResponse.json(
        { error: "Demasiados intentos. Pedí un código nuevo e intentá de nuevo en unos minutos." },
        { status: 429 }
      );
    }

    // Tomamos el código vigente más reciente de este usuario (si pidió
    // reenvío, el anterior queda automáticamente obsoleto por no ser el más nuevo).
    const result = await pool.query<{
      id_codigo: number;
      codigo_hash: string;
      expira_en: string;
      usado: boolean;
      intentos: number;
    }>(
      `SELECT id_codigo, codigo_hash, expira_en, usado, intentos
       FROM codigo_verificacion
       WHERE id_usuario = $1
       ORDER BY creado_en DESC
       LIMIT 1`,
      [idUsuario]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "No hay un código pendiente para este usuario" }, { status: 400 });
    }

    const fila = result.rows[0];

    if (fila.usado) {
      return NextResponse.json({ error: "Este código ya fue utilizado" }, { status: 400 });
    }

    if (new Date(fila.expira_en).getTime() < Date.now()) {
      return NextResponse.json({ error: "El código expiró. Iniciá sesión de nuevo." }, { status: 400 });
    }

    if (fila.intentos >= getMaxIntentos()) {
      return NextResponse.json(
        { error: "Demasiados intentos fallidos. Iniciá sesión de nuevo para pedir un código nuevo." },
        { status: 429 }
      );
    }

    if (!compararCodigo(codigo, fila.codigo_hash)) {
      await pool.query(`UPDATE codigo_verificacion SET intentos = intentos + 1 WHERE id_codigo = $1`, [
        fila.id_codigo,
      ]);
      log.warn({ id_usuario: idUsuario }, "Código 2FA incorrecto");
      return NextResponse.json({ error: "Código incorrecto" }, { status: 401 });
    }

    await pool.query(`UPDATE codigo_verificacion SET usado = TRUE WHERE id_codigo = $1`, [fila.id_codigo]);

    const usuarioResult = await pool.query<{
      id_usuario: number;
      nombre: string;
      correo: string;
      tipo_usuario: string;
      id_bodega: number | null;
      sesion_version: number;
    }>(
      `SELECT id_usuario, nombre, correo, tipo_usuario, id_bodega, sesion_version
         FROM usuario
        WHERE id_usuario = $1 AND estado_usuario = TRUE`,
      [idUsuario]
    );

    if (usuarioResult.rows.length === 0) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    const usuario = usuarioResult.rows[0];
    const token = signAuthToken(usuario);
    // El token viaja SOLO en la cookie httpOnly (ver nota en /api/login).
    const response = NextResponse.json({ ok: true, usuario });

    response.cookies.set(AUTH_COOKIE, token, authCookieOptions());

    response.cookies.set("session", "", { path: "/", maxAge: 0 });

    await registrarAuditoria({
      id_usuario: usuario.id_usuario,
      correo: usuario.correo,
      tipo_evento: TIPOS_EVENTO.LOGIN_OK,
      ip: getClientIp(req),
      user_agent: req.headers.get("user-agent"),
      detalle: { tipo_usuario: usuario.tipo_usuario, con_2fa: true, etapa: "verificado" },
    });

    log.info({ id_usuario: usuario.id_usuario, tipo_usuario: usuario.tipo_usuario }, "Login exitoso (2FA verificado)");

    return response;
  } catch (error) {
    return apiError("LOGIN VERIFICAR-CODIGO POST", error);
  }
}
