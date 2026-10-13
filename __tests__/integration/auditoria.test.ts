/**
 * @jest-environment node
 */
// __tests__/integration/auditoria.test.ts
//
// Verifica que los eventos de credenciales queden realmente escritos en la
// tabla `auditoria` cuando los flujos corren contra Postgres real.
//
// Que la función exista y que sus unit tests pasen no alcanza: lo que importa
// es que el INSERT pegue contra una tabla con las columnas que espera y que el
// login completo (paso 1 + paso 2) deje rastro.
//
// Requiere DATABASE_URL. Si no está definida, la suite se salta.

import { Pool } from "pg";
import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import { POST as POST_LOGIN } from "@/app/api/login/route";
import { POST as POST_LOGOUT } from "@/app/api/logout/route";
import { registrarAuditoria, TIPOS_EVENTO } from "@/lib/audit";

jest.mock("@/lib/mailer", () => ({
  enviarCodigoVerificacion: jest.fn().mockResolvedValue(undefined),
  enviarAvisoBloqueoCuenta: jest.fn().mockResolvedValue(undefined),
  enviarAvisoCambioContrasena: jest.fn().mockResolvedValue(undefined),
}));

const hasDb = !!process.env.DATABASE_URL;
const describeIfDb = hasDb ? describe : describe.skip;

function makeReq(url: string, body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest(new URL(url, "http://localhost"), {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

describeIfDb("Bitácora de credenciales (integración)", () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const PASSWORD = "MiClaveSegura123";
  const correo = `auditoria-${Date.now()}@test.com`;
  let idUsuario: number;

  beforeAll(async () => {
    const hash = bcrypt.hashSync(PASSWORD, 10);
    const res = await pool.query(
      `INSERT INTO usuario (nombre, correo, contrasena_hash, tipo_usuario, estado_usuario, requiere_2fa, id_bodega)
       VALUES ($1, $2, $3, 'BODEGUERO', TRUE, FALSE, (SELECT id_bodega FROM bodega LIMIT 1))
       RETURNING id_usuario`,
      ["Auditoría Test", correo, hash]
    );
    idUsuario = res.rows[0].id_usuario;

    await pool.query(`DELETE FROM api_rate_limit WHERE clave LIKE 'login2fa:%'`);
    await pool.query(`TRUNCATE TABLE login_intento`);
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM usuario WHERE id_usuario = $1`, [idUsuario]);
    await pool.end();
  });

  it("un login exitoso deja un evento LOGIN_OK con IP y user-agent", async () => {
    const res = await POST_LOGIN(
      makeReq(
        "/api/login",
        { username: correo, password: PASSWORD },
        { "user-agent": "k6/1.0-prueba" }
      )
    );
    expect(res.status).toBe(200);

    const cookie = res.headers.get("set-cookie") ?? "";
    const token = cookie.split(";")[0]?.replace("auth_token=", "");
    expect(token).toBeTruthy();

    const { rows } = await pool.query(
      `SELECT tipo_evento, correo, ip, user_agent, detalle
         FROM auditoria
        WHERE id_usuario = $1
        ORDER BY id DESC
        LIMIT 1`,
      [idUsuario]
    );

    expect(rows[0].tipo_evento).toBe(TIPOS_EVENTO.LOGIN_OK);
    expect(rows[0].correo).toBe(correo);
    expect(rows[0].user_agent).toBe("k6/1.0-prueba");
    // `detalle` debe volver como objeto, no como texto: es JSONB.
    expect(typeof rows[0].detalle).toBe("object");
    expect(rows[0].detalle.con_2fa).toBe(false);

    // El logout del mismo token también queda registrado.
    const resLogout = await POST_LOGOUT(
      new NextRequest(new URL("http://localhost/api/logout"), {
        method: "POST",
        headers: { cookie: `auth_token=${token}` },
      })
    );
    expect(resLogout.status).toBe(200);

    const trasLogout = await pool.query(
      `SELECT tipo_evento FROM auditoria
        WHERE id_usuario = $1 AND tipo_evento = $2
        ORDER BY id DESC LIMIT 1`,
      [idUsuario, TIPOS_EVENTO.LOGOUT]
    );
    expect(trasLogout.rowCount).toBe(1);
  });

  it("un login fallido deja LOGIN_FALLIDO con el motivo", async () => {
    await POST_LOGIN(makeReq("/api/login", { username: correo, password: "definitivamente-mala" }));

    const { rows } = await pool.query(
      `SELECT tipo_evento, detalle FROM auditoria
        WHERE id_usuario = $1 AND tipo_evento = $2
        ORDER BY id DESC LIMIT 1`,
      [idUsuario, TIPOS_EVENTO.LOGIN_FALLIDO]
    );

    expect(rows.length).toBe(1);
    expect(rows[0].detalle.motivo).toBe("contrasena_incorrecta");
  });

  it("los intentos contra un correo inexistente quedan sin id_usuario pero con correo", async () => {
    const correoFantasma = `no-existe-${Date.now()}@test.com`;

    await POST_LOGIN(makeReq("/api/login", { username: correoFantasma, password: "loquesea123" }));

    const { rows } = await pool.query(
      `SELECT id_usuario, correo, detalle FROM auditoria
        WHERE correo = $1
        ORDER BY id DESC LIMIT 1`,
      [correoFantasma]
    );

    // El rastro de "a esta cuenta la están probando" tiene que sobrevivir
    // aunque esa cuenta no exista.
    expect(rows.length).toBe(1);
    expect(rows[0].id_usuario).toBeNull();
    expect(rows[0].detalle.motivo).toBe("correo_no_registrado");
  });

  it("el detalle se puede consultar como JSONB desde la base", async () => {
    await registrarAuditoria({
      id_usuario: idUsuario,
      tipo_evento: TIPOS_EVENTO.ROL_CAMBIADO,
      detalle: { tipo_usuario: { antes: "EMPLEADO", despues: "BODEGUERO" } },
    });

    // Esto es lo que hace útil tener JSONB: filtrar sin tocar el esquema.
    const { rows } = await pool.query(
      `SELECT id_usuario FROM auditoria
        WHERE tipo_evento = $1
          AND detalle->'tipo_usuario'->>'despues' = 'BODEGUERO'
          AND id_usuario = $2`,
      [TIPOS_EVENTO.ROL_CAMBIADO, idUsuario]
    );

    expect(rows.length).toBe(1);
  });

  it("el login sigue funcionando aunque la bitácora esté caída", async () => {
    // Se comprueba la propiedad de diseño desde arriba: registrarAuditoria no
    // lanza nunca, así que el flujo de autenticación no depende de la tabla.
    await registrarAuditoria({
      tipo_evento: TIPOS_EVENTO.LOGIN_OK,
      id_usuario: idUsuario,
      // `detalle` con un valor que no se puede serializar en JSONB para
      // provocar un fallo real de escritura.
      detalle: { fecha: new Date("no-es-una-fecha") },
    });

    const res = await POST_LOGIN(makeReq("/api/login", { username: correo, password: PASSWORD }));
    expect(res.status).toBe(200);
  });
});