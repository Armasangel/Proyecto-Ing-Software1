// app/api/login/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import { AUTH_COOKIE, signAuthToken, verifyPassword } from "@/lib/auth";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const username = typeof body.username === "string" ? body.username.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!username || !password) {
      return NextResponse.json(
        { error: "Usuario y contraseña son obligatorios" },
        { status: 400 }
      );
    }

    const result = await pool.query<{
      id_usuario: number
      nombre: string
      correo: string
      tipo_usuario: string
      contrasena_hash: string
    }>(
      `SELECT id_usuario, nombre, correo, tipo_usuario, contrasena_hash
       FROM usuario
       WHERE LOWER(correo) = LOWER($1) AND estado_usuario = TRUE`,
      [username]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Credenciales incorrectas" }, { status: 401 });
    }

    const row = result.rows[0];
    if (!verifyPassword(password, row.contrasena_hash)) {
      return NextResponse.json({ error: "Credenciales incorrectas" }, { status: 401 });
    }

    const usuario = {
      id_usuario: row.id_usuario,
      nombre: row.nombre,
      correo: row.correo,
      tipo_usuario: row.tipo_usuario,
    };

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
    return NextResponse.json(
      { error: "Error del servidor", detalle: String(error) },
      { status: 500 }
    );
  }
}
