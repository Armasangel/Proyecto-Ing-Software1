import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { AUTH_COOKIE, signAuthToken } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { apiError, validationError } from "@/lib/api-error";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { nombre, correo, telefono, contrasena } = body;

    if (!nombre || !correo || !contrasena) {
      return validationError("Nombre, correo y contraseña son obligatorios");
    }

    if (contrasena.length < 6) {
      return validationError("La contraseña debe tener al menos 6 caracteres");
    }

    const existe = await pool.query(
      `SELECT id_usuario FROM usuario WHERE LOWER(correo) = LOWER($1)`,
      [correo]
    );

    if (existe.rows.length > 0) {
      return NextResponse.json(
        { error: "Ya existe una cuenta con ese correo" },
        { status: 409 }
      );
    }

    const contrasena_hash = await bcrypt.hashSync(contrasena, 10);

    const result = await pool.query<{
      id_usuario: number;
      nombre: string;
      correo: string;
      tipo_usuario: string;
    }>(
      `INSERT INTO usuario (nombre, correo, telefono, contrasena_hash, tipo_usuario)
       VALUES ($1, $2, $3, $4, 'COMPRADOR')
       RETURNING id_usuario, nombre, correo, tipo_usuario`,
      [nombre, correo, telefono || null, contrasena_hash]
    );

    const usuario = result.rows[0];
    const token = signAuthToken(usuario);

    const response = NextResponse.json({ ok: true, token, usuario });

    response.cookies.set(AUTH_COOKIE, token, {
      httpOnly: true,
      path: "/",
      maxAge: 60 * 60 * 8,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    return response;
  } catch (error) {
    return apiError("REGISTER POST", error);
  }
}