import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import {
  AUTH_COOKIE,
  authCookieOptions,
  signAuthToken,
  verifyPassword,
} from "@/lib/auth";
import { apiError } from "@/lib/api-error";
import { getLogger } from "@/lib/logger";
import { TIPOS_USUARIO } from "@/lib/roles";
import { enviarAvisoBloqueoCuenta, enviarCodigoVerificacion } from "@/lib/mailer";
import { registrarAcceso } from "@/lib/sesion";
import { registrarAuditoria, TIPOS_EVENTO } from "@/lib/audit";
import {
  enmascararCorreo,
  fechaExpiracion,
  generarCodigo,
  hashCodigo,
  signPreToken,
} from "@/lib/verificacion";
import {
  ACCOUNT_LOCKOUT_MAX,
  ACCOUNT_LOCKOUT_WINDOW_MS,
  clearFailedLogins,
  claveCuenta,
  claveIp,
  getClientIp,
  isLoginRateLimited,
  recordFailedLogin,
} from "@/lib/login-rate-limit";

const log = getLogger("api/login");

/**
 * Hash señuelo para que el tiempo de respuesta sea el mismo exista o no el
 * usuario. Sin esto, un correo no registrado devuelve en ~1 ms y uno
 * registrado con contraseña incorrecta en ~80 ms (el costo de bcrypt), lo que
 * permite enumerar qué correos tienen cuenta probando la API de login.
 */
const HASH_SENUELO = "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const userAgent = req.headers.get("user-agent");
    const ipClave = claveIp(ip);

    if (await isLoginRateLimited(ipClave)) {
      log.warn({ ip }, "Intento de login bloqueado por rate limit");
      return NextResponse.json(
        { error: "Demasiados intentos. Intenta de nuevo en un minuto." },
        { status: 429 }
      );
    }

    const body = await req.json();
    const username = typeof body.username === "string" ? body.username.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!username || !password) {
      return NextResponse.json(
        { error: "Usuario y contraseña son obligatorios" },
        { status: 400 }
      );
    }

    const cuentaClave = claveCuenta(username);

    // Bloqueo por cuenta además del de IP: frena el credential stuffing
    // distribuido, que reparte los intentos entre muchas direcciones.
    if (await isLoginRateLimited(cuentaClave)) {
      log.warn({ ip, cuenta: cuentaClave }, "Cuenta bloqueada por intentos fallidos");
      // Respuesta idéntica a la de credenciales incorrectas: no se confirma
      // que la cuenta exista ni que esté bloqueada.
      return NextResponse.json({ error: "Credenciales incorrectas" }, { status: 401 });
    }

    const result = await pool.query<{
      id_usuario: number;
      nombre: string;
      correo: string;
      tipo_usuario: string;
      id_bodega: number | null;
      contrasena_hash: string;
      requiere_2fa: boolean;
      requiere_cambio_contrasena: boolean;
      sesion_version: number;
    }>(
      `SELECT id_usuario, nombre, correo, tipo_usuario, id_bodega, contrasena_hash,
              requiere_2fa, requiere_cambio_contrasena, sesion_version
         FROM usuario
        WHERE LOWER(correo) = LOWER($1) AND estado_usuario = TRUE`,
      [username]
    );

    if (result.rows.length === 0) {
      // Se ejecuta el bcrypt igual, contra el hash señuelo, para no filtrar por
      // tiempo si el correo existe.
      await verifyPassword(password, HASH_SENUELO);

      await recordFailedLogin(ipClave);
      await registrarAuditoria({
        correo: username,
        tipo_evento: TIPOS_EVENTO.LOGIN_FALLIDO,
        ip,
        user_agent: userAgent,
        // Sin id_usuario: justamente se está registrando que ese correo NO
        // corresponde a ninguna cuenta.
        detalle: { motivo: "correo_no_registrado" },
      });
      log.warn({ ip }, "Login fallido: usuario no encontrado");
      return NextResponse.json({ error: "Credenciales incorrectas" }, { status: 401 });
    }

    const row = result.rows[0];

    if (!verifyPassword(password, row.contrasena_hash)) {
      await recordFailedLogin(ipClave);

      // Aviso al dueño de la cuenta sólo en el intento que realmente la
      // bloquea, no en los siguientes (ver recordFailedLogin).
      const seBloqueo = await recordFailedLogin(
        cuentaClave,
        ACCOUNT_LOCKOUT_MAX,
        ACCOUNT_LOCKOUT_WINDOW_MS
      );
      if (seBloqueo) {
        await registrarAuditoria({
          id_usuario: row.id_usuario,
          correo: row.correo,
          tipo_evento: TIPOS_EVENTO.CUENTA_BLOQUEADA,
          ip,
          user_agent: userAgent,
          detalle: { minutos: ACCOUNT_LOCKOUT_WINDOW_MS / 60000, intentos: ACCOUNT_LOCKOUT_MAX },
        });

        try {
          await enviarAvisoBloqueoCuenta(
            row.correo,
            row.nombre,
            ACCOUNT_LOCKOUT_WINDOW_MS / 60000,
            ip
          );
        } catch (mailError) {
          // El bloqueo ya está aplicado en la base; que falle el aviso no
          // debe convertir un 401 en un 500.
          log.error({ err: mailError, id_usuario: row.id_usuario }, "No se pudo enviar el aviso de bloqueo de cuenta");
        }
      }

      await registrarAuditoria({
        id_usuario: row.id_usuario,
        correo: row.correo,
        tipo_evento: TIPOS_EVENTO.LOGIN_FALLIDO,
        ip,
        user_agent: userAgent,
        detalle: { motivo: "contrasena_incorrecta" },
      });
      log.warn({ ip, id_usuario: row.id_usuario }, "Login fallido: contraseña incorrecta");
      return NextResponse.json({ error: "Credenciales incorrectas" }, { status: 401 });
    }

    await clearFailedLogins(ipClave);
    await clearFailedLogins(cuentaClave);

    // Cuenta con una contraseña que se conoce públicamente (la de ejemplo
    // del seed). Se bloquea el login hasta que la cambie por el flujo de
    // recuperación, que exige confirmar por correo.
    if (row.requiere_cambio_contrasena) {
      await registrarAuditoria({
        id_usuario: row.id_usuario,
        correo: row.correo,
        tipo_evento: TIPOS_EVENTO.LOGIN_FALLIDO,
        ip,
        user_agent: userAgent,
        detalle: { motivo: "requiere_cambio_contrasena" },
      });
      log.warn(
        { ip, id_usuario: row.id_usuario },
        "Login bloqueado: la cuenta debe cambiar su contraseña"
      );
      return NextResponse.json(
        {
          error:
            "Por seguridad tienes que cambiar tu contraseña antes de continuar. Usa «¿Olvidaste tu contraseña?» en la pantalla de acceso.",
        },
        { status: 403 }
      );
    }

    await registrarAcceso(row.id_usuario, ip);

    const usuario = {
      id_usuario: row.id_usuario,
      nombre: row.nombre,
      correo: row.correo,
      tipo_usuario: row.tipo_usuario,
      id_bodega: row.id_bodega,
      // Sin esto, el token se firmaría con la versión 1 por defecto y, tras
      // una revocación, el usuario no podría volver a entrar nunca.
      sesion_version: row.sesion_version,
    };

    // El 2FA aplica solo a EMPLEADO: es el rol que maneja dinero, facturación
    // y datos de clientes. DUENO y BODEGUERO entran directo; para el dueño,
    // la columna requiere_2fa se ignora aunque haya quedado en TRUE.
    //
    // Dentro de los EMPLEADO, el dueño puede eximir puntualmente a alguno
    // (columna requiere_2fa), p. ej. mientras se resuelve un problema con su
    // correo.
    if (
      row.tipo_usuario === TIPOS_USUARIO.DUENO ||
      row.tipo_usuario === TIPOS_USUARIO.BODEGUERO ||
      row.requiere_2fa === false
    ) {
      const token = signAuthToken(usuario);
      // El token viaja SOLO en la cookie httpOnly. Devolverlo también en el
      // cuerpo de la respuesta lo haría legible desde JavaScript y anularía
      // la protección httpOnly frente a XSS.
      const response = NextResponse.json({
        ok: true,
        requiere_verificacion: false,
        usuario,
      });

      response.cookies.set(AUTH_COOKIE, token, authCookieOptions());
      response.cookies.set("session", "", { path: "/", maxAge: 0 });

      await registrarAuditoria({
        id_usuario: usuario.id_usuario,
        correo: usuario.correo,
        tipo_evento: TIPOS_EVENTO.LOGIN_OK,
        ip,
        user_agent: userAgent,
        detalle: { tipo_usuario: usuario.tipo_usuario, con_2fa: false },
      });

      log.info({ id_usuario: usuario.id_usuario, tipo_usuario: usuario.tipo_usuario, ip }, "Login exitoso (sin 2FA)");

      return response;
    }

    // Usuario y contraseña correctos: paso 1 completo. En vez de dar el
    // AUTH_COOKIE de una vez, generamos el código de verificación en 2 pasos,
    // lo guardamos hasheado con vencimiento corto, y se lo mandamos por correo.
    const codigo = generarCodigo();
    const codigoHash = hashCodigo(codigo);
    const expiraEn = fechaExpiracion();

    await pool.query(
      `INSERT INTO codigo_verificacion (id_usuario, codigo_hash, expira_en)
       VALUES ($1, $2, $3)`,
      [row.id_usuario, codigoHash, expiraEn]
    );

    try {
      await enviarCodigoVerificacion(row.correo, codigo);
      await registrarAuditoria({
        id_usuario: row.id_usuario,
        correo: row.correo,
        tipo_evento: TIPOS_EVENTO.LOGIN_OK,
        ip,
        user_agent: userAgent,
        detalle: { tipo_usuario: row.tipo_usuario, con_2fa: true, etapa: "codigo_enviado" },
      });
      log.info({ id_usuario: row.id_usuario, ip }, "Código 2FA enviado por correo");
    } catch (mailError) {
      log.error({ err: mailError }, "No se pudo enviar el código de verificación");
      return NextResponse.json(
        { error: "No se pudo enviar el código de verificación. Intenta de nuevo en un momento." },
        { status: 502 }
      );
    }

    const preToken = signPreToken(row.id_usuario);

    return NextResponse.json({
      ok: true,
      requiere_verificacion: true,
      pre_token: preToken,
      correo_enmascarado: enmascararCorreo(row.correo),
    });
  } catch (error) {
    return apiError("LOGIN POST", error);
  }
}
