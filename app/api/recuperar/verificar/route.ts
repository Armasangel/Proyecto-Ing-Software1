// app/api/recuperar/verificar/route.ts
//
// Paso 2 del flujo "olvidé mi contraseña": valida el código de 6 dígitos que
// llegó por correo. Si es correcto, devuelve un reset_token de corta duración
// (10 min) que es lo único que autoriza a escribir la nueva contraseña.

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { apiError } from "@/lib/api-error";
import { getLogger } from "@/lib/logger";
import { compararCodigo, getMaxIntentos, signResetToken } from "@/lib/verificacion";

const log = getLogger("api/recuperar/verificar");

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const correo = typeof body.correo === "string" ? body.correo.trim().toLowerCase() : "";
    const codigo = typeof body.codigo === "string" ? body.codigo.trim() : "";

    if (!correo || !codigo) {
      return NextResponse.json({ error: "Faltan datos para verificar el código" }, { status: 400 });
    }

    const usuarioResult = await pool.query<{ id_usuario: number }>(
      `SELECT id_usuario FROM usuario
       WHERE LOWER(correo) = LOWER($1) AND estado_usuario = TRUE`,
      [correo]
    );

    // Mismo mensaje genérico para cualquier falla del código (correo inexistente,
    // código vencido, incorrecto, etc.) para no revelar qué correos existen.
    const errorGenerico =
      "Código incorrecto o vencido. Pedí un código nuevo para recuperar tu contraseña.";

    if (usuarioResult.rows.length === 0) {
      log.warn({ correo }, "Verificación de recuperación para correo no registrado");
      return NextResponse.json({ error: errorGenerico }, { status: 400 });
    }

    const idUsuario = usuarioResult.rows[0].id_usuario;

    // Tomamos el código vigente más reciente de este usuario (si pidió
    // reenvío, el anterior queda obsoleto por no ser el más nuevo).
    const result = await pool.query<{
      id_recuperacion: number;
      codigo_hash: string;
      expira_en: string;
      usado: boolean;
      intentos: number;
    }>(
      `SELECT id_recuperacion, codigo_hash, expira_en, usado, intentos
       FROM codigo_recuperacion
       WHERE id_usuario = $1
       ORDER BY creado_en DESC
       LIMIT 1`,
      [idUsuario]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: errorGenerico }, { status: 400 });
    }

    const fila = result.rows[0];

    if (fila.usado) {
      return NextResponse.json({ error: errorGenerico }, { status: 400 });
    }

    if (new Date(fila.expira_en).getTime() < Date.now()) {
      return NextResponse.json({ error: errorGenerico }, { status: 400 });
    }

    if (fila.intentos >= getMaxIntentos()) {
      return NextResponse.json(
        { error: errorGenerico },
        { status: 429 }
      );
    }

    if (!compararCodigo(codigo, fila.codigo_hash)) {
      await pool.query(
        `UPDATE codigo_recuperacion SET intentos = intentos + 1 WHERE id_recuperacion = $1`,
        [fila.id_recuperacion]
      );
      log.warn({ id_usuario: idUsuario }, "Código de recuperación incorrecto");
      return NextResponse.json({ error: errorGenerico }, { status: 401 });
    }

    await pool.query(
      `UPDATE codigo_recuperacion SET usado = TRUE WHERE id_recuperacion = $1`,
      [fila.id_recuperacion]
    );

    const resetToken = signResetToken(idUsuario);

    log.info({ id_usuario: idUsuario }, "Código de recuperación validado");

    return NextResponse.json({ ok: true, reset_token: resetToken });
  } catch (error) {
    return apiError("RECUPERAR VERIFICAR POST", error);
  }
}