// app/api/login/verificar-codigo/route.ts
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { AUTH_COOKIE, signAuthToken } from "@/lib/auth";
import { apiError } from "@/lib/api-error";
import { compararCodigo, getMaxIntentos, verifyPreToken } from "@/lib/verificacion";

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
      return NextResponse.json(
        { error: "La sesión de verificación expiró. Iniciá sesión de nuevo." },
        { status: 401 }
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
      return NextResponse.json({ error: "Código incorrecto" }, { status: 401 });
    }

    await pool.query(`UPDATE codigo_verificacion SET usado = TRUE WHERE id_codigo = $1`, [fila.id_codigo]);

    const usuarioResult = await pool.query<{
      id_usuario: number;
      nombre: string;
      correo: string;
      tipo_usuario: string;
    }>(
      `SELECT id_usuario, nombre, correo, tipo_usuario FROM usuario WHERE id_usuario = $1 AND estado_usuario = TRUE`,
      [idUsuario]
    );

    if (usuarioResult.rows.length === 0) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    const usuario = usuarioResult.rows[0];
    const token = signAuthToken(usuario);
    const response = NextResponse.json({ ok: true, token, usuario });

    response.cookies.set(AUTH_COOKIE, token, {
      httpOnly: true,
      path: "/",
      maxAge: 60 * 60 * 8,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    response.cookies.set("session", "", { path: "/", maxAge: 0 });

    return response;
  } catch (error) {
    return apiError("LOGIN VERIFICAR-CODIGO POST", error);
  }
}