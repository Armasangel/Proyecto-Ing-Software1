// app/api/usuarios/promover-dueno/solicitar/route.ts
//
// Paso 1 del proceso de ascenso a DUENO: un dueño ya autenticado pide que
// otro usuario ya existente se vuelva dueño. Acá NO se aplica el cambio
// todavía — solo se valida que se pueda hacer, se genera un código de 6
// dígitos y se manda al correo del propio dueño que lo solicita. El cambio
// real se aplica en /promover-dueno/confirmar (paso 2), con ese código.
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getUsuarioFromRequest } from "@/lib/server-auth";
import { isDuenoTipo, MAX_DUENOS, TIPOS_USUARIO } from "@/lib/roles";
import { apiError, tooManyRequestsError, unauthorizedError, validationError } from "@/lib/api-error";
import { checkRateLimit, getClientIp } from "@/lib/api-rate-limit";
import { enviarCodigoPromocionDueno } from "@/lib/mailer";
import {
  enmascararCorreo,
  fechaExpiracion,
  generarCodigo,
  hashCodigo,
  signPromocionToken,
} from "@/lib/verificacion";
import { getLogger } from "@/lib/logger";

const log = getLogger("api/usuarios/promover-dueno/solicitar");

export async function POST(req: NextRequest) {
  // Límite bajo: esto manda un correo real y arranca un proceso sensible.
  const rl = await checkRateLimit(`promover-dueno:solicitar:${getClientIp(req)}`, 5, 60_000);
  if (rl.limited) return tooManyRequestsError(rl.retryAfterSeconds);

  const solicitante = getUsuarioFromRequest(req);
  if (!solicitante || !isDuenoTipo(solicitante.tipo_usuario)) {
    return unauthorizedError();
  }

  try {
    const body = await req.json();
    const idObjetivo = Number(body.id_usuario);
    if (!idObjetivo || idObjetivo < 1) {
      return validationError("id_usuario inválido");
    }

    if (idObjetivo === solicitante.id_usuario) {
      return validationError("Ya eres dueño de esta cuenta");
    }

    // Traemos también al dueño solicitante desde la BD (no del JWT) para
    // tener su correo y estado actualizados, y confirmar que sigue activo.
    const [objetivoResult, solicitanteResult] = await Promise.all([
      pool.query<{ id_usuario: number; nombre: string; tipo_usuario: string; estado_usuario: boolean }>(
        `SELECT id_usuario, nombre, tipo_usuario, estado_usuario FROM usuario WHERE id_usuario = $1`,
        [idObjetivo]
      ),
      pool.query<{ id_usuario: number; correo: string; estado_usuario: boolean }>(
        `SELECT id_usuario, correo, estado_usuario FROM usuario WHERE id_usuario = $1`,
        [solicitante.id_usuario]
      ),
    ]);

    if (objetivoResult.rowCount === 0) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }
    if (solicitanteResult.rowCount === 0 || !solicitanteResult.rows[0].estado_usuario) {
      return unauthorizedError();
    }

    const objetivo = objetivoResult.rows[0];
    const correoSolicitante = solicitanteResult.rows[0].correo;

    if (objetivo.tipo_usuario === TIPOS_USUARIO.DUENO) {
      return validationError("Ese usuario ya es dueño");
    }
    if (!objetivo.estado_usuario) {
      return validationError("No se puede promover a un usuario con la cuenta inactiva");
    }

    // Chequeo temprano del límite: evita mandar un código de verificación
    // para una promoción que de todas formas no se va a poder confirmar. El
    // chequeo que realmente importa (contra condiciones de carrera) es el
    // del paso de confirmación, dentro de una transacción con lock.
    const conteo = await pool.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM usuario WHERE tipo_usuario = $1`,
      [TIPOS_USUARIO.DUENO]
    );
    if (conteo.rows[0].count >= MAX_DUENOS) {
      return validationError(
        `Ya existen ${MAX_DUENOS} usuarios dueño, el máximo permitido. Hay que quitarle el rol a alguno antes de agregar otro.`
      );
    }

    const codigo = generarCodigo();
    const codigoHash = hashCodigo(codigo);
    const expiraEn = fechaExpiracion();

    const solicitud = await pool.query<{ id_solicitud: number }>(
      `INSERT INTO solicitud_promocion_dueno (id_usuario_objetivo, id_dueno_solicitante, codigo_hash, expira_en)
       VALUES ($1, $2, $3, $4)
       RETURNING id_solicitud`,
      [idObjetivo, solicitante.id_usuario, codigoHash, expiraEn]
    );

    const idSolicitud = solicitud.rows[0].id_solicitud;

    try {
      await enviarCodigoPromocionDueno(correoSolicitante, codigo, objetivo.nombre);
      log.info(
        { id_solicitud: idSolicitud, id_usuario_objetivo: idObjetivo, id_dueno_solicitante: solicitante.id_usuario },
        "Código de promoción a dueño enviado por correo"
      );
    } catch (mailError) {
      log.error({ err: mailError }, "No se pudo enviar el código de promoción a dueño");
      return NextResponse.json(
        { error: "No se pudo enviar el código de verificación. Intenta de nuevo en un momento." },
        { status: 502 }
      );
    }

    const token = signPromocionToken(idSolicitud);

    return NextResponse.json({
      ok: true,
      token,
      correo_enmascarado: enmascararCorreo(correoSolicitante),
    });
  } catch (error) {
    return apiError("PROMOVER-DUENO SOLICITAR POST", error);
  }
}
