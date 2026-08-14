import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { verifyPassword } from "@/lib/auth";
import { apiError } from "@/lib/api-error";
import { enviarCodigoVerificacion } from "@/lib/mailer";
import { fechaExpiracion, generarCodigo, hashCodigo, signPreToken } from "@/lib/verificacion";

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
      id_usuario: number;
      nombre: string;
      correo: string;
      tipo_usuario: string;
      contrasena_hash: string;
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

    // Usuario y contraseña correctos: paso 1 completo. En vez de dar el
    // AUTH_COOKIE de una vez, generamos el código de verificación en 2 pasos,
    // lo guardamos hasheado con vencimiento corto, y se lo mandamos por correo.
    const codigo = generarCodigo();
    const codigoHash = hashCodigo(codigo);
    const expiraEn = fechaExpiracion();

    await pool.query(
      `INSERT INTO codigo_verificacion (id_usuario, codigo_hash, expira_en)
       VALUES ($1, $2, $3)`,
      [row.id_usuario, codigoHash, expiraEn]
    );

    try {
      await enviarCodigoVerificacion(row.correo, codigo);
    } catch (mailError) {
      console.error("Error enviando código de verificación:", mailError);
      return NextResponse.json(
        { error: "No se pudo enviar el código de verificación. Intenta de nuevo en un momento." },
        { status: 502 }
      );
    }

    const preToken = signPreToken(row.id_usuario);

    return NextResponse.json({
      ok: true,
      requiere_verificacion: true,
      pre_token: preToken,
      correo_enmascarado: enmascararCorreo(row.correo),
    });
  } catch (error) {
    return apiError("LOGIN POST", error);
  }
}

// Muestra el correo parcialmente oculto en el paso 2, ej. "ma***@tienda.com",
// para confirmarle al usuario a dónde llegó el código sin exponerlo entero.
function enmascararCorreo(correo: string): string {
  const [usuario, dominio] = correo.split("@");
  if (!dominio) return correo;
  const visible = usuario.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(usuario.length - 2, 1))}@${dominio}`;
}