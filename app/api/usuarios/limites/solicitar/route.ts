// app/api/usuarios/limites/solicitar/route.ts
//
// Paso 1 del cambio de límite de usuarios por tipo: un dueño autenticado pide
// fijar (o quitar) el tope de un tipo. Acá NO se aplica nada todavía: se valida
// la petición, se genera un código de 6 dígitos y se manda al correo del propio
// dueño. El cambio real se aplica en /limites/confirmar (paso 2).
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getUsuarioFromRequest } from "@/lib/server-auth";
import { isDuenoTipo, labelRol } from "@/lib/roles";
import { apiError, tooManyRequestsError, unauthorizedError, validationError } from "@/lib/api-error";
import { checkRateLimit, getClientIp } from "@/lib/api-rate-limit";
import { enviarCodigoCambioLimite } from "@/lib/mailer";
import {
  enmascararCorreo,
  fechaExpiracion,
  generarCodigo,
  hashCodigo,
  signLimiteToken,
} from "@/lib/verificacion";
import {
  LIMITE_MAXIMO_CONFIGURABLE,
  esTipoLimitable,
  leerCupo,
} from "@/lib/limites-usuarios";
import { getLogger } from "@/lib/logger";

const log = getLogger("api/usuarios/limites/solicitar");

export async function POST(req: NextRequest) {
  // Límite bajo: esto manda un correo real y arranca un proceso sensible.
  const rl = await checkRateLimit(`usuarios-limites:solicitar:${getClientIp(req)}`, 5, 60_000);
  if (rl.limited) return tooManyRequestsError(rl.retryAfterSeconds);

  const solicitante = getUsuarioFromRequest(req);
  if (!solicitante || !isDuenoTipo(solicitante.tipo_usuario)) {
    return unauthorizedError();
  }

  try {
    const body = await req.json();
    const { tipo_usuario, max_usuarios } = body ?? {};

    if (!esTipoLimitable(tipo_usuario)) {
      return validationError("tipo_usuario inválido");
    }

    // null = quitar el límite. Si no, entero positivo dentro del tope razonable.
    let nuevoLimite: number | null;
    if (max_usuarios === null) {
      nuevoLimite = null;
    } else if (
      typeof max_usuarios === "number" &&
      Number.isInteger(max_usuarios) &&
      max_usuarios >= 1 &&
      max_usuarios <= LIMITE_MAXIMO_CONFIGURABLE
    ) {
      nuevoLimite = max_usuarios;
    } else {
      return validationError(
        `max_usuarios debe ser un entero entre 1 y ${LIMITE_MAXIMO_CONFIGURABLE}, o null para quitar el límite`
      );
    }

    // Se toma el correo y el estado del solicitante desde la BD (no del JWT).
    const solicitanteResult = await pool.query<{ correo: string; estado_usuario: boolean }>(
      `SELECT correo, estado_usuario FROM usuario WHERE id_usuario = $1`,
      [solicitante.id_usuario]
    );
    if (solicitanteResult.rowCount === 0 || !solicitanteResult.rows[0].estado_usuario) {
      return unauthorizedError();
    }
    const correoSolicitante = solicitanteResult.rows[0].correo;

    // Chequeo temprano: no tiene sentido mandar un código para un límite que
    // quedaría por debajo de los usuarios activos que ya existen.
    const cupo = await leerCupo(pool, tipo_usuario);
    if (cupo.limite === nuevoLimite) {
      return validationError("Ese ya es el límite configurado para ese tipo de usuario");
    }
    if (nuevoLimite !== null && nuevoLimite < cupo.activos) {
      return validationError(
        `Hay ${cupo.activos} usuarios activos tipo ${labelRol(tipo_usuario).toLowerCase()}; el límite no puede ser menor. Desactiva a alguno primero.`
      );
    }

    const codigo = generarCodigo();
    const codigoHash = hashCodigo(codigo);
    const expiraEn = fechaExpiracion();

    const solicitud = await pool.query<{ id_solicitud: number }>(
      `INSERT INTO solicitud_cambio_limite (tipo_usuario, nuevo_limite, id_dueno_solicitante, codigo_hash, expira_en)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id_solicitud`,
      [tipo_usuario, nuevoLimite, solicitante.id_usuario, codigoHash, expiraEn]
    );
    const idSolicitud = solicitud.rows[0].id_solicitud;

    try {
      await enviarCodigoCambioLimite(
        correoSolicitante,
        codigo,
        labelRol(tipo_usuario),
        nuevoLimite === null ? "sin límite" : String(nuevoLimite)
      );
      log.info(
        { id_solicitud: idSolicitud, tipo_usuario, nuevo_limite: nuevoLimite, id_dueno_solicitante: solicitante.id_usuario },
        "Código de cambio de límite enviado por correo"
      );
    } catch (mailError) {
      log.error({ err: mailError }, "No se pudo enviar el código de cambio de límite");
      return NextResponse.json(
        { error: "No se pudo enviar el código de verificación. Intenta de nuevo en un momento." },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      token: signLimiteToken(idSolicitud),
      correo_enmascarado: enmascararCorreo(correoSolicitante),
    });
  } catch (error) {
    return apiError("USUARIOS LIMITES SOLICITAR POST", error);
  }
}
