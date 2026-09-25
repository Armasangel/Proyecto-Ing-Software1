// app/api/usuarios/promover-dueno/confirmar/route.ts
//
// Paso 2 del proceso de ascenso a DUENO: valida el código de 6 dígitos que
// se mandó en /solicitar y, si es correcto, recién ahí aplica el cambio de
// tipo_usuario. Todo el chequeo del límite (MAX_DUENOS) y la aplicación del
// cambio ocurren dentro de una misma transacción con un advisory lock, para
// que dos promociones confirmadas casi al mismo tiempo no se cuelen las dos
// y dejen más dueños de los permitidos.
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getUsuarioFromRequest } from "@/lib/server-auth";
import { isDuenoTipo, MAX_DUENOS, TIPOS_USUARIO } from "@/lib/roles";
import { apiError, tooManyRequestsError, unauthorizedError, validationError } from "@/lib/api-error";
import { checkRateLimit, getClientIp } from "@/lib/api-rate-limit";
import { compararCodigo, getMaxIntentos, verifyPromocionToken } from "@/lib/verificacion";
import { getLogger } from "@/lib/logger";

const log = getLogger("api/usuarios/promover-dueno/confirmar");

export async function POST(req: NextRequest) {
  const rl = await checkRateLimit(`promover-dueno:confirmar:${getClientIp(req)}`, 10, 60_000);
  if (rl.limited) return tooManyRequestsError(rl.retryAfterSeconds);

  const solicitante = getUsuarioFromRequest(req);
  if (!solicitante || !isDuenoTipo(solicitante.tipo_usuario)) {
    return unauthorizedError();
  }

  let body: { token?: unknown; codigo?: unknown };
  try {
    body = await req.json();
  } catch {
    return validationError("Cuerpo de la solicitud inválido");
  }

  const token = typeof body.token === "string" ? body.token : "";
  const codigo = typeof body.codigo === "string" ? body.codigo.trim() : "";

  if (!token || !codigo) {
    return validationError("Faltan datos para confirmar la promoción");
  }

  const idSolicitud = verifyPromocionToken(token);
  if (!idSolicitud) {
    return NextResponse.json(
      { error: "La solicitud de promoción expiró o no es válida. Iniciá el proceso de nuevo." },
      { status: 401 }
    );
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Serializa entre sí todas las confirmaciones de promoción a dueño, para
    // que el conteo contra MAX_DUENOS sea confiable aunque dos solicitudes
    // se confirmen casi al mismo tiempo.
    await client.query("SELECT pg_advisory_xact_lock(hashtext('promocion_dueno'))");

    const solicitudResult = await client.query<{
      id_solicitud: number;
      id_usuario_objetivo: number;
      id_dueno_solicitante: number;
      codigo_hash: string;
      expira_en: string;
      usado: boolean;
      intentos: number;
    }>(
      `SELECT id_solicitud, id_usuario_objetivo, id_dueno_solicitante, codigo_hash, expira_en, usado, intentos
       FROM solicitud_promocion_dueno
       WHERE id_solicitud = $1
       FOR UPDATE`,
      [idSolicitud]
    );

    if (solicitudResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Solicitud de promoción no encontrada" }, { status: 404 });
    }

    const fila = solicitudResult.rows[0];

    // Solo el mismo dueño que la inició puede confirmarla — evita que otro
    // dueño (o alguien con la cookie de otro) la confirme en su lugar.
    if (fila.id_dueno_solicitante !== solicitante.id_usuario) {
      await client.query("ROLLBACK");
      return unauthorizedError();
    }

    if (fila.usado) {
      await client.query("ROLLBACK");
      return validationError("Esta solicitud ya fue utilizada");
    }

    if (new Date(fila.expira_en).getTime() < Date.now()) {
      await client.query("ROLLBACK");
      return validationError("El código expiró. Iniciá el proceso de promoción de nuevo.");
    }

    if (fila.intentos >= getMaxIntentos()) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "Demasiados intentos fallidos. Iniciá el proceso de promoción de nuevo." },
        { status: 429 }
      );
    }

    if (!compararCodigo(codigo, fila.codigo_hash)) {
      await client.query(
        `UPDATE solicitud_promocion_dueno SET intentos = intentos + 1 WHERE id_solicitud = $1`,
        [fila.id_solicitud]
      );
      await client.query("COMMIT");
      log.warn({ id_solicitud: fila.id_solicitud }, "Código de promoción a dueño incorrecto");
      return NextResponse.json({ error: "Código incorrecto" }, { status: 401 });
    }

    // Revalidación final del límite, ya con el advisory lock tomado: si
    // otra promoción se coló entre el "solicitar" y este momento, se
    // rechaza acá aunque el código en sí sea correcto.
    const conteo = await client.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM usuario WHERE tipo_usuario = $1`,
      [TIPOS_USUARIO.DUENO]
    );
    if (conteo.rows[0].count >= MAX_DUENOS) {
      await client.query("ROLLBACK");
      return validationError(
        `Ya existen ${MAX_DUENOS} usuarios dueño, el máximo permitido. La promoción no se pudo aplicar.`
      );
    }

    const objetivoResult = await client.query<{ tipo_usuario: string; estado_usuario: boolean }>(
      `SELECT tipo_usuario, estado_usuario FROM usuario WHERE id_usuario = $1 FOR UPDATE`,
      [fila.id_usuario_objetivo]
    );
    if (objetivoResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "El usuario a promover ya no existe" }, { status: 404 });
    }
    if (objetivoResult.rows[0].tipo_usuario === TIPOS_USUARIO.DUENO) {
      await client.query("ROLLBACK");
      return validationError("Ese usuario ya es dueño");
    }
    if (!objetivoResult.rows[0].estado_usuario) {
      await client.query("ROLLBACK");
      return validationError("No se puede promover a un usuario con la cuenta inactiva");
    }

    const actualizado = await client.query(
      `UPDATE usuario
       SET tipo_usuario = $1
       WHERE id_usuario = $2
       RETURNING id_usuario, nombre, correo, tipo_usuario, estado_usuario, id_bodega, requiere_2fa`,
      [TIPOS_USUARIO.DUENO, fila.id_usuario_objetivo]
    );

    await client.query(`UPDATE solicitud_promocion_dueno SET usado = TRUE WHERE id_solicitud = $1`, [
      fila.id_solicitud,
    ]);

    await client.query("COMMIT");

    log.info(
      { id_usuario_objetivo: fila.id_usuario_objetivo, id_dueno_solicitante: solicitante.id_usuario },
      "Usuario promovido a DUENO"
    );

    return NextResponse.json({ ok: true, usuario: actualizado.rows[0] });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Si el ROLLBACK también falla la conexión ya está en mal estado;
      // se libera igual en el finally y el pool la descarta.
    }
    return apiError("PROMOVER-DUENO CONFIRMAR POST", error);
  } finally {
    client.release();
  }
}
