/**
 * @jest-environment node
 */
// __tests__/integration/login-2fa.test.ts
//
// Prueba el flujo completo de login en 2 pasos contra Postgres real:
// paso 1 (usuario+contraseña) guarda el código hasheado en la base,
// paso 2 (código) lo valida contra esa misma fila y entrega el AUTH_COOKIE.
//
// El envío de correo se mockea (no hay credenciales de Gmail en este
// entorno de pruebas) — todo lo demás (DB, hashing, tokens) es real.
//
// Requiere DATABASE_URL. Si no está definida, la suite se salta.

jest.mock("@/lib/mailer", () => ({
  enviarCodigoVerificacion: jest.fn().mockResolvedValue(undefined),
}));

import { Pool } from "pg";
import bcrypt from "bcryptjs";
import { POST as POST_LOGIN } from "@/app/api/login/route";
import { POST as POST_VERIFICAR } from "@/app/api/login/verificar-codigo/route";
import { enviarCodigoVerificacion } from "@/lib/mailer";
import { NextRequest } from "next/server";

const hasDb = !!process.env.DATABASE_URL;
const describeIfDb = hasDb ? describe : describe.skip;

function makeReq(url: string, body: unknown) {
  return new NextRequest(new URL(url, "http://localhost"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describeIfDb("Login en 2 pasos — flujo completo (integración)", () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const correo = `login2fa-${Date.now()}@test.com`;
  const password = "MiClaveSegura123";
  let idUsuario: number;
  beforeAll(async () => {
    const hash = bcrypt.hashSync(password, 10);
    const res = await pool.query(
      `INSERT INTO usuario (nombre, correo, contrasena_hash, tipo_usuario, estado_usuario)
       VALUES ($1, $2, $3, 'EMPLEADO', TRUE) RETURNING id_usuario`,
      ["Usuario 2FA Test", correo, hash]
    );
    idUsuario = res.rows[0].id_usuario;
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM codigo_verificacion WHERE id_usuario = $1`, [idUsuario]);
    await pool.query(`DELETE FROM usuario WHERE id_usuario = $1`, [idUsuario]);
    await pool.end();
  });

  it("guarda el código hasheado (no en texto plano) y no lo entrega en la respuesta", async () => {
    const res = await POST_LOGIN(makeReq("/api/login", { username: correo, password }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.requiere_verificacion).toBe(true);
    expect(data.token).toBeUndefined();

    const fila = await pool.query(
      `SELECT codigo_hash FROM codigo_verificacion WHERE id_usuario = $1 ORDER BY creado_en DESC LIMIT 1`,
      [idUsuario]
    );
    expect(fila.rows).toHaveLength(1);
    // El hash no debe ser el código en texto plano ni contenerlo.
    expect(fila.rows[0].codigo_hash).toMatch(/^\$2[aby]\$/); // formato bcrypt
  });

  it("completa el login con el código correcto y rechaza uno incorrecto", async () => {
    const resLogin = await POST_LOGIN(makeReq("/api/login", { username: correo, password }));
    const dataLogin = await resLogin.json();

    // Recuperamos el código real (nunca viaja al cliente) directamente
    // del mock del mailer, como haría el usuario leyendo su correo.
    const mockMailer = enviarCodigoVerificacion as jest.Mock;
    const codigoReal = mockMailer.mock.calls[mockMailer.mock.calls.length - 1][1] as string;
    expect(codigoReal).toMatch(/^\d{6}$/);

    // Código incorrecto: rechazado, no entrega cookie.
    const resMalo = await POST_VERIFICAR(
      makeReq("/api/login/verificar-codigo", { pre_token: dataLogin.pre_token, codigo: "000001" })
    );
    expect([401, 400]).toContain(resMalo.status); // 401 salvo que "000001" coincida por casualidad

    // Código correcto: entra y setea el auth_token.
    const resBueno = await POST_VERIFICAR(
      makeReq("/api/login/verificar-codigo", { pre_token: dataLogin.pre_token, codigo: codigoReal })
    );
    const dataBueno = await resBueno.json();
    expect(resBueno.status).toBe(200);
    expect(dataBueno.ok).toBe(true);
    expect(typeof dataBueno.token).toBe("string");
    expect(resBueno.headers.get("set-cookie")).toContain("auth_token=");

    // El mismo código no puede reusarse una segunda vez.
    const resReuso = await POST_VERIFICAR(
      makeReq("/api/login/verificar-codigo", { pre_token: dataLogin.pre_token, codigo: codigoReal })
    );
    expect(resReuso.status).toBe(400);
  });

  it("el dueño (DUENO) entra directo sin pasar por el código de verificación", async () => {
    const correoDueno = `login2fa-dueno-${Date.now()}@test.com`;
    const hash = bcrypt.hashSync(password, 10);
    const resInsert = await pool.query(
      `INSERT INTO usuario (nombre, correo, contrasena_hash, tipo_usuario, estado_usuario)
       VALUES ($1, $2, $3, 'DUENO', TRUE) RETURNING id_usuario`,
      ["Dueño 2FA Test", correoDueno, hash]
    );
    const idDueno = resInsert.rows[0].id_usuario;

    try {
      const res = await POST_LOGIN(makeReq("/api/login", { username: correoDueno, password }));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.requiere_verificacion).toBe(false);
      expect(typeof data.token).toBe("string");
      expect(res.headers.get("set-cookie")).toContain("auth_token=");

      // No debe haber ningún código pendiente para el dueño.
      const filas = await pool.query(
        `SELECT COUNT(*)::int AS n FROM codigo_verificacion WHERE id_usuario = $1`,
        [idDueno]
      );
      expect(filas.rows[0].n).toBe(0);
    } finally {
      await pool.query(`DELETE FROM codigo_verificacion WHERE id_usuario = $1`, [idDueno]);
      await pool.query(`DELETE FROM usuario WHERE id_usuario = $1`, [idDueno]);
    }
  });
});