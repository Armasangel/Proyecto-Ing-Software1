// app/api/usuarios/limites/confirmar/route.ts
//
// Paso 2 del cambio de límite: valida el código de 6 dígitos de /solicitar y,
// si es correcto, aplica el límite. Todo ocurre en una transacción con el mismo
// advisory lock por tipo que usa el trigger de la BD, para que un alta
// simultánea no deje más usuarios activos que el nuevo tope.
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getUsuarioFromRequest } from "@/lib/server-auth";
import { isDuenoTipo, labelRol } from "@/lib/roles";
import { apiError, tooManyRequestsError, unauthorizedError, validationError } from "@/lib/api-error";
import { checkRateLimit, getClientIp } from "@/lib/api-rate-limit";
import { compararCodigo, getMaxIntentos, verifyLimiteToken } from "@/lib/verificacion";
import { getLogger } from "@/lib/logger";

const log = getLogger("api/usuarios/limites/confirmar");

export async function POST(req: NextRequest) {
  const rl = await checkRateLimit(`usuarios-limites:confirmar:${getClientIp(req)}`, 10, 60_000);
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
    return validationError("Faltan datos para confirmar el cambio de límite");
  }

  const idSolicitud = verifyLimiteToken(token);
  if (!idSolicitud) {
    return NextResponse.json(
      { error: "La solicitud expiró o no es válida. Inicia el proceso de nuevo." },
      { status: 401 }
    );
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const solicitudResult = await client.query<{
      id_solicitud: number;
      tipo_usuario: string;
      nuevo_limite: number | null;
      id_dueno_solicitante: number;
      codigo_hash: string;
      expira_en: string;
      usado: boolean;
      intentos: number;
    }>(
      `SELECT id_solicitud, tipo_usuario, nuevo_limite, id_dueno_solicitante, codigo_hash, expira_en, usado, intentos
         FROM solicitud_cambio_limite
        WHERE id_solicitud = $1
        FOR UPDATE`,
      [idSolicitud]
    );

    if (solicitudResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Solicitud no encontrada" }, { status: 404 });
    }

    const fila = solicitudResult.rows[0];

    // Solo el mismo dueño que la inició puede confirmarla.
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
      return validationError("El código expiró. Inicia el proceso de nuevo.");
    }
    if (fila.intentos >= getMaxIntentos()) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "Demasiados intentos fallidos. Inicia el proceso de nuevo." },
        { status: 429 }
      );
    }

    if (!compararCodigo(codigo, fila.codigo_hash)) {
      await client.query(
        `UPDATE solicitud_cambio_limite SET intentos = intentos + 1 WHERE id_solicitud = $1`,
        [fila.id_solicitud]
      );
      await client.query("COMMIT");
      log.warn({ id_solicitud: fila.id_solicitud }, "Código de cambio de límite incorrecto");
      return NextResponse.json({ error: "Código incorrecto" }, { status: 401 });
    }

    // Mismo lock que toma el trigger de usuario para este tipo.
    await client.query("SELECT pg_advisory_xact_lock(hashtext('limite_usuarios:' || $1::text))", [
      fila.tipo_usuario,
    ]);

    // Revalidación final: pudieron darse de alta usuarios entre /solicitar y acá.
    if (fila.nuevo_limite !== null) {
      const conteo = await client.query<{ count: number }>(
        `SELECT COUNT(*)::int AS count FROM usuario WHERE tipo_usuario = $1 AND estado_usuario = TRUE`,
        [fila.tipo_usuario]
      );
      if (conteo.rows[0].count > fila.nuevo_limite) {
        await client.query("ROLLBACK");
        return validationError(
          `Ahora hay ${conteo.rows[0].count} usuarios activos tipo ${labelRol(fila.tipo_usuario).toLowerCase()}; el límite no puede ser menor. Desactiva a alguno primero.`
        );
      }
    }

    const actualizado = await client.query<{ tipo_usuario: string; max_usuarios: number | null }>(
      `INSERT INTO limite_tipo_usuario (tipo_usuario, max_usuarios, actualizado_en, actualizado_por)
       VALUES ($1, $2, NOW(), $3)
       ON CONFLICT (tipo_usuario)
       DO UPDATE SET max_usuarios = EXCLUDED.max_usuarios,
                     actualizado_en = NOW(),
                     actualizado_por = EXCLUDED.actualizado_por
       RETURNING tipo_usuario, max_usuarios`,
      [fila.tipo_usuario, fila.nuevo_limite, solicitante.id_usuario]
    );

    await client.query(`UPDATE solicitud_cambio_limite SET usado = TRUE WHERE id_solicitud = $1`, [
      fila.id_solicitud,
    ]);

    await client.query("COMMIT");

    log.info(
      { tipo_usuario: fila.tipo_usuario, nuevo_limite: fila.nuevo_limite, id_dueno_solicitante: solicitante.id_usuario },
      "Límite de usuarios actualizado"
    );

    return NextResponse.json({
      ok: true,
      limite: { tipo_usuario: actualizado.rows[0].tipo_usuario, limite: actualizado.rows[0].max_usuarios },
    });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // La conexión ya está en mal estado; el finally la libera y el pool la descarta.
    }
    return apiError("USUARIOS LIMITES CONFIRMAR POST", error);
  } finally {
    client.release();
  }
}
