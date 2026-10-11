// app/api/usuarios/mi-cuenta/route.ts
//
// Datos de seguridad de la cuenta propia: cuándo entró la última vez, desde
// dónde, y si tiene o no el segundo paso de verificación.
//
// El "último acceso" es la señal más útil que tiene un usuario para detectar un
// robo de sesión: si la hora o la IP no coinciden con lo suyo, hay que cambiar
// la contraseña y cerrar las sesiones.

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getUsuarioFromRequest } from "@/lib/server-auth";
import { apiError, unauthorizedError } from "@/lib/api-error";
import { labelRol } from "@/lib/roles";

export async function GET(req: NextRequest) {
  try {
    const usuario = getUsuarioFromRequest(req);
    if (!usuario) {
      return unauthorizedError();
    }

    const fila = await pool.query<{
      nombre: string;
      correo: string;
      tipo_usuario: string;
      requiere_2fa: boolean;
      ultimo_login_en: Date | null;
      ultimo_login_ip: string | null;
    }>(
      `SELECT nombre, correo, tipo_usuario, requiere_2fa, ultimo_login_en, ultimo_login_ip
         FROM usuario
        WHERE id_usuario = $1`,
      [usuario.id_usuario]
    );

    if (fila.rowCount === 0) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    const cuenta = fila.rows[0];

    return NextResponse.json({
      cuenta: {
        id_usuario: usuario.id_usuario,
        nombre: cuenta.nombre,
        correo: cuenta.correo,
        tipo_usuario: cuenta.tipo_usuario,
        rol_label: labelRol(cuenta.tipo_usuario),
        requiere_2fa: cuenta.requiere_2fa,
        ultimo_login_en: cuenta.ultimo_login_en,
        ultimo_login_ip: cuenta.ultimo_login_ip,
      },
    });
  } catch (error) {
    return apiError("USUARIOS MI-CUENTA GET", error);
  }
}