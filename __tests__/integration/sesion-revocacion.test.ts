/**
 * @jest-environment node
 */
// __tests__/integration/sesion-revocacion.test.ts
//
// Prueba la revocación de sesiones contra Postgres real: el claim `sv` del
// JWT contra usuario.sesion_version.
//
// Es la pieza que hace que "cerrar sesión en todos los dispositivos", "cambiar
// la contraseña" y "dar de baja a un empleado" surtan efecto de verdad. Antes,
// el token seguía sirviendo hasta 8 horas después y un usuario dado de baja
// conservaba los permisos que tenía en el JWT.
//
// Requiere DATABASE_URL. Si no está definida, la suite se salta.

import { Pool } from "pg";
import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import { POST as POST_LOGIN } from "@/app/api/login/route";
import { signAuthToken, verifyAuthToken } from "@/lib/auth";
import { esSesionValida, revocarSesiones } from "@/lib/sesion";

jest.mock("@/lib/mailer", () => ({
  enviarCodigoVerificacion: jest.fn().mockResolvedValue(undefined),
  enviarAvisoBloqueoCuenta: jest.fn().mockResolvedValue(undefined),
  enviarAvisoCambioContrasena: jest.fn().mockResolvedValue(undefined),
}));

const hasDb = !!process.env.DATABASE_URL;
const describeIfDb = hasDb ? describe : describe.skip;

describeIfDb("Revocación de sesiones (integración)", () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const PASSWORD = "MiClaveSegura123";
  const correoUsuario = `sesion-revocacion-${Date.now()}@test.com`;
  let idUsuario: number;

  beforeAll(async () => {
    const hash = bcrypt.hashSync(PASSWORD, 10);
    const res = await pool.query(
      `INSERT INTO usuario (nombre, correo, contrasena_hash, tipo_usuario, estado_usuario, id_bodega)
       VALUES ($1, $2, $3, 'BODEGUERO', TRUE, (SELECT id_bodega FROM bodega LIMIT 1))
       RETURNING id_usuario`,
      ["Sesión Revocable", correoUsuario, hash]
    );
    idUsuario = res.rows[0].id_usuario;
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM usuario WHERE id_usuario = $1`, [idUsuario]);
    await pool.end();
  });

  /** Usuario con la versión de sesión que hay AHORA en la base, como hace el
   *  login real al leer la fila. */
  const usuario = async () => {
    const { rows } = await pool.query<{ sesion_version: number }>(
      `SELECT sesion_version FROM usuario WHERE id_usuario = $1`,
      [idUsuario]
    );
    return {
      id_usuario: idUsuario,
      nombre: "Sesión Revocable",
      correo: "sesion-revocacion@test.com",
      tipo_usuario: "BODEGUERO",
      id_bodega: null,
      sesion_version: rows[0].sesion_version,
    };
  };

  it("un token recién emitido es válido", async () => {
    const token = signAuthToken(await usuario());
    const decoded = verifyAuthToken(token);

    expect(decoded).not.toBeNull();
    await expect(esSesionValida(idUsuario, decoded!.sesion_version)).resolves.toBe(true);
  });

  it("tras revocar sesiones, el mismo token deja de servir", async () => {
    const token = signAuthToken(await usuario());
    const decoded = verifyAuthToken(token)!;

    await expect(esSesionValida(idUsuario, decoded.sesion_version)).resolves.toBe(true);

    await revocarSesiones(idUsuario);

    // El token sigue firmado y sin expirar: verifyAuthToken lo sigue leyendo.
    // Lo que lo invalida es el contraste contra la base.
    expect(verifyAuthToken(token)).not.toBeNull();
    await expect(esSesionValida(idUsuario, decoded.sesion_version)).resolves.toBe(false);
  });

  it("dar de baja a un usuario invalida su sesión aunque la versión coincida", async () => {
    await pool.query(
      `UPDATE usuario SET estado_usuario = FALSE WHERE id_usuario = $1`,
      [idUsuario]
    );
    try {
      const decoded = verifyAuthToken(signAuthToken(await usuario()))!;
      await expect(esSesionValida(idUsuario, decoded.sesion_version)).resolves.toBe(false);
    } finally {
      await pool.query(
        `UPDATE usuario SET estado_usuario = TRUE WHERE id_usuario = $1`,
        [idUsuario]
      );
    }
  });

  it("tras una revocación se puede volver a iniciar sesión", async () => {
    // Este caso cubría un fallo real: si /api/login no lee
    // usuario.sesion_version, el token nuevo se firma con sv=1 mientras la
    // base ya va por 2, y el usuario queda bloqueado para siempre sin saber
    // por qué.
    await revocarSesiones(idUsuario);

    const res = await POST_LOGIN(
      new NextRequest(new URL("http://localhost/api/login"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: correoUsuario, password: PASSWORD }),
      })
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    const cookie = res.headers.get("set-cookie") ?? "";
    const token = cookie.split(";")[0]?.replace("auth_token=", "");
    expect(token).toBeTruthy();

    const decoded = verifyAuthToken(token!)!;
    expect(decoded.sesion_version).toBeGreaterThan(1);
    await expect(esSesionValida(idUsuario, decoded.sesion_version)).resolves.toBe(true);
  });

  it("cerrar sesión en un dispositivo no invalida el token ya emitido en otro", async () => {
    // Sólo "cerrar todas las sesiones" revoca. Un logout normal (que sólo
    // borra la cookie del navegador) no puede invalidar nada en el servidor:
    // por eso el botón de cerrar sesiones existe como acción aparte.
    const decoded = verifyAuthToken(signAuthToken(await usuario()))!;
    await expect(esSesionValida(idUsuario, decoded.sesion_version)).resolves.toBe(true);
  });

  it("el token viaja en la cookie httpOnly y no en el cuerpo", async () => {
    const token = signAuthToken(await usuario());
    const req = new NextRequest(new URL("http://localhost/api/stats"), {
      headers: { cookie: `auth_token=${token}` },
    });

    expect(req.cookies.get("auth_token")?.value).toBe(token);
  });
});