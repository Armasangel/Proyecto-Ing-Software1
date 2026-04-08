// app/api/login/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function POST(req: NextRequest) {
  try {
    const { correo, contrasena } = await req.json();

    if (!correo || !contrasena) {
      return NextResponse.json({ error: "Correo y contraseña requeridos" }, { status: 400 });
    }

    const result = await pool.query(
      `SELECT id_usuario, nombre, correo, tipo_usuario
       FROM usuario
       WHERE correo = $1 AND contrasena_hash = $2 AND estado_usuario = TRUE`,
      [correo, contrasena]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Credenciales incorrectas" }, { status: 401 });
    }

    const usuario = result.rows[0];
    const response = NextResponse.json({ ok: true, usuario });

    response.cookies.set("session", JSON.stringify(usuario), {
      httpOnly: true,
      path: "/",
      maxAge: 60 * 60 * 8,
    });

    return response;
  } catch (error) {
    return NextResponse.json({ error: "Error del servidor", detalle: String(error) }, { status: 500 });
  }
}
