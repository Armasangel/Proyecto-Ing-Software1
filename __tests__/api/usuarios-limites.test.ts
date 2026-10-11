import { GET } from "@/app/api/usuarios/limites/route";
import { POST as SOLICITAR } from "@/app/api/usuarios/limites/solicitar/route";
import { POST as CONFIRMAR } from "@/app/api/usuarios/limites/confirmar/route";
import { POST as CREAR_USUARIO } from "@/app/api/usuarios/route";
import bcrypt from "bcryptjs";
import { createMockRequest, testUserDueno, testUserEmpleado } from "@/__tests__/utils/api-test-utils";
import { checkRateLimit } from "@/lib/api-rate-limit";
import { enviarCodigoCambioLimite } from "@/lib/mailer";
import { signLimiteToken, signPromocionToken, verifyLimiteToken } from "@/lib/verificacion";

jest.mock("@/lib/db", () => ({
  pool: { query: jest.fn(), connect: jest.fn() },
}));
jest.mock("@/lib/api-rate-limit", () => ({
  checkRateLimit: jest.fn(),
  getClientIp: jest.fn(() => "1.2.3.4"),
}));
jest.mock("@/lib/mailer", () => ({
  enviarCodigoCambioLimite: jest.fn(),
}));

const mockPool = jest.requireMock("@/lib/db").pool as { query: jest.Mock; connect: jest.Mock };
const mockRate = checkRateLimit as jest.MockedFunction<typeof checkRateLimit>;
const mockMailer = enviarCodigoCambioLimite as jest.MockedFunction<typeof enviarCodigoCambioLimite>;

beforeEach(() => {
  jest.resetAllMocks();
  mockRate.mockResolvedValue({ limited: false, retryAfterSeconds: 0, restantes: 5 });
  mockMailer.mockResolvedValue(undefined);
});

describe("token del cambio de límite", () => {
  it("round-trips the id_solicitud and rejects tokens with another purpose", () => {
    expect(verifyLimiteToken(signLimiteToken(7))).toBe(7);
    expect(verifyLimiteToken(signPromocionToken(7))).toBeNull();
    expect(verifyLimiteToken("basura")).toBeNull();
  });
});

describe("GET /api/usuarios/limites", () => {
  it("returns 403 for a non-dueño", async () => {
    const res = await GET(createMockRequest("/api/usuarios/limites", { user: testUserEmpleado }));
    expect(res.status).toBe(403);
  });

  it("returns the cupo of each tipo for a dueño", async () => {
    mockPool.query.mockResolvedValueOnce({
      rows: [
        { tipo_usuario: "BODEGUERO", limite: null, activos: 1 },
        { tipo_usuario: "DUENO", limite: 2, activos: 1 },
        { tipo_usuario: "EMPLEADO", limite: 5, activos: 3 },
      ],
    });
    const res = await GET(createMockRequest("/api/usuarios/limites", { user: testUserDueno }));
    expect(res.status).toBe(200);
    expect((await res.json()).limites).toHaveLength(3);
  });
});

describe("POST /api/usuarios/limites/solicitar", () => {
  const req = (body: unknown, user = testUserDueno) =>
    createMockRequest("/api/usuarios/limites/solicitar", { method: "POST", user, body });
  const solicitanteFila = { correo: testUserDueno.correo, estado_usuario: true };

  it("returns 403 for a non-dueño", async () => {
    const res = await SOLICITAR(req({ tipo_usuario: "EMPLEADO", max_usuarios: 3 }, testUserEmpleado));
    expect(res.status).toBe(403);
  });

  it.each([
    [{ tipo_usuario: "ADMIN", max_usuarios: 3 }],
    [{ tipo_usuario: "EMPLEADO", max_usuarios: 0 }],
    [{ tipo_usuario: "EMPLEADO", max_usuarios: 2.5 }],
    [{ tipo_usuario: "EMPLEADO", max_usuarios: "3" }],
    [{ tipo_usuario: "EMPLEADO", max_usuarios: 100000 }],
    [{ tipo_usuario: "EMPLEADO" }],
  ])("rejects invalid body %j", async (body) => {
    const res = await SOLICITAR(req(body));
    expect(res.status).toBe(400);
    expect(mockMailer).not.toHaveBeenCalled();
  });

  it("rejects a limit lower than the active users", async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [solicitanteFila], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ configurado: true, limite: null, activos: 4 }] });
    const res = await SOLICITAR(req({ tipo_usuario: "EMPLEADO", max_usuarios: 3 }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/4 usuarios activos/);
    expect(mockMailer).not.toHaveBeenCalled();
  });

  it("rejects when the limit is already the configured one", async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [solicitanteFila], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ configurado: true, limite: 3, activos: 1 }] });
    const res = await SOLICITAR(req({ tipo_usuario: "EMPLEADO", max_usuarios: 3 }));
    expect(res.status).toBe(400);
  });

  it("emails a code to the requesting dueño and returns a token", async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [solicitanteFila], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ configurado: true, limite: null, activos: 1 }] })
      .mockResolvedValueOnce({ rows: [{ id_solicitud: 9 }], rowCount: 1 });
    const res = await SOLICITAR(req({ tipo_usuario: "EMPLEADO", max_usuarios: 3 }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(verifyLimiteToken(data.token)).toBe(9);
    expect(data.correo_enmascarado).toMatch(/\*/);
    expect(mockMailer).toHaveBeenCalledWith(testUserDueno.correo, expect.stringMatching(/^\d{6}$/), "Colaborador", "3");
  });

  it("accepts null to remove the limit", async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [solicitanteFila], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ configurado: true, limite: 3, activos: 1 }] })
      .mockResolvedValueOnce({ rows: [{ id_solicitud: 10 }], rowCount: 1 });
    const res = await SOLICITAR(req({ tipo_usuario: "EMPLEADO", max_usuarios: null }));
    expect(res.status).toBe(200);
    expect(mockMailer).toHaveBeenCalledWith(expect.any(String), expect.any(String), "Colaborador", "sin límite");
  });

  it("returns 502 when the email cannot be sent", async () => {
    mockMailer.mockRejectedValue(new Error("smtp"));
    mockPool.query
      .mockResolvedValueOnce({ rows: [solicitanteFila], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ configurado: true, limite: null, activos: 1 }] })
      .mockResolvedValueOnce({ rows: [{ id_solicitud: 11 }], rowCount: 1 });
    const res = await SOLICITAR(req({ tipo_usuario: "EMPLEADO", max_usuarios: 3 }));
    expect(res.status).toBe(502);
  });
});

describe("POST /api/usuarios/limites/confirmar", () => {
  const req = (body: unknown, user = testUserDueno) =>
    createMockRequest("/api/usuarios/limites/confirmar", { method: "POST", user, body });

  const fila = {
    id_solicitud: 9,
    tipo_usuario: "EMPLEADO",
    nuevo_limite: 3,
    id_dueno_solicitante: testUserDueno.id_usuario,
    codigo_hash: "",
    expira_en: new Date(Date.now() + 60_000).toISOString(),
    usado: false,
    intentos: 0,
  };

  function clientConRespuestas(respuestas: unknown[]) {
    const client = { query: jest.fn(), release: jest.fn() };
    client.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // BEGIN
    for (const r of respuestas) client.query.mockResolvedValueOnce(r);
    client.query.mockResolvedValue({ rows: [], rowCount: 0 });
    mockPool.connect.mockResolvedValue(client);
    return client;
  }

  it("returns 401 for an invalid token", async () => {
    const res = await CONFIRMAR(req({ token: "x", codigo: "123456" }));
    expect(res.status).toBe(401);
  });

  it("returns 403 when another dueño tries to confirm", async () => {
    clientConRespuestas([{ rows: [{ ...fila, id_dueno_solicitante: 999 }], rowCount: 1 }]);
    const res = await CONFIRMAR(req({ token: signLimiteToken(9), codigo: "123456" }));
    expect(res.status).toBe(403);
  });

  it("returns 401 and counts the attempt when the code is wrong", async () => {
    const client = clientConRespuestas([{ rows: [{ ...fila, codigo_hash: bcrypt.hashSync("111111", 4) }], rowCount: 1 }]);
    const res = await CONFIRMAR(req({ token: signLimiteToken(9), codigo: "000000" }));
    expect(res.status).toBe(401);
    expect(client.query.mock.calls.some((c) => String(c[0]).includes("intentos + 1"))).toBe(true);
  });

  it("returns 429 after too many attempts", async () => {
    clientConRespuestas([{ rows: [{ ...fila, intentos: 5 }], rowCount: 1 }]);
    const res = await CONFIRMAR(req({ token: signLimiteToken(9), codigo: "123456" }));
    expect(res.status).toBe(429);
  });

  it("rejects when the active users now exceed the new limit", async () => {
    const client = clientConRespuestas([
      { rows: [{ ...fila, codigo_hash: bcrypt.hashSync("123456", 4) }], rowCount: 1 }, // solicitud
      { rows: [], rowCount: 0 }, // advisory lock
      { rows: [{ count: 5 }], rowCount: 1 }, // conteo activos
    ]);
    const res = await CONFIRMAR(req({ token: signLimiteToken(9), codigo: "123456" }));
    expect(res.status).toBe(400);
    expect(client.query).toHaveBeenCalledWith("ROLLBACK");
  });

  it("applies the limit with a correct code", async () => {
    const client = clientConRespuestas([
      { rows: [{ ...fila, codigo_hash: bcrypt.hashSync("123456", 4) }], rowCount: 1 },
      { rows: [], rowCount: 0 }, // advisory lock
      { rows: [{ count: 2 }], rowCount: 1 }, // conteo activos
      { rows: [{ tipo_usuario: "EMPLEADO", max_usuarios: 3 }], rowCount: 1 }, // upsert
    ]);
    const res = await CONFIRMAR(req({ token: signLimiteToken(9), codigo: "123456" }));
    expect(res.status).toBe(200);
    expect((await res.json()).limite).toEqual({ tipo_usuario: "EMPLEADO", limite: 3 });
    expect(client.query).toHaveBeenCalledWith("COMMIT");
    expect(client.release).toHaveBeenCalled();
  });
});

describe("alta de usuario con el límite alcanzado (trigger de la BD)", () => {
  it("returns 409 with a clear message when the trigger raises LU001", async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // correo duplicado
      .mockRejectedValueOnce(Object.assign(new Error("LIMITE_USUARIOS"), { code: "LU001", detail: "EMPLEADO", hint: "3" }));
    const res = await CREAR_USUARIO(
      createMockRequest("/api/usuarios", {
        method: "POST",
        user: testUserDueno,
        body: { nombre: "Ana", correo: "ana@tienda.com", contrasena: "secreto1", tipo_usuario: "EMPLEADO" },
      })
    );
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.codigo).toBe("LIMITE_USUARIOS");
    expect(data.error).toMatch(/3 usuarios activos tipo colaborador/);
  });
});
