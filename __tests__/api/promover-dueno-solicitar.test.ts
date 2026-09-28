import { POST } from "@/app/api/usuarios/promover-dueno/solicitar/route";
import { createMockRequest, testUserDueno, testUserEmpleado } from "@/__tests__/utils/api-test-utils";
import { checkRateLimit } from "@/lib/api-rate-limit";
import { enviarCodigoPromocionDueno } from "@/lib/mailer";
import { verifyPromocionToken } from "@/lib/verificacion";
import { MAX_DUENOS } from "@/lib/roles";

jest.mock("@/lib/db", () => ({
  pool: { query: jest.fn(), connect: jest.fn() },
}));

jest.mock("@/lib/api-rate-limit", () => ({
  checkRateLimit: jest.fn(),
  getClientIp: jest.fn(() => "1.2.3.4"),
}));

jest.mock("@/lib/mailer", () => ({
  enviarCodigoPromocionDueno: jest.fn(),
}));

const mockPool = jest.requireMock("@/lib/db").pool as { query: jest.Mock };
const mockCheckRateLimit = checkRateLimit as jest.MockedFunction<typeof checkRateLimit>;
const mockMailer = enviarCodigoPromocionDueno as jest.MockedFunction<typeof enviarCodigoPromocionDueno>;

function makeReq(body: unknown, user = testUserDueno) {
  return createMockRequest("/api/usuarios/promover-dueno/solicitar", {
    method: "POST",
    user,
    body,
  });
}

const objetivoValido = {
  id_usuario: 2,
  nombre: "María López",
  tipo_usuario: "EMPLEADO",
  estado_usuario: true,
};

const solicitanteFila = {
  id_usuario: testUserDueno.id_usuario,
  correo: testUserDueno.correo,
  estado_usuario: true,
};

describe("POST /api/usuarios/promover-dueno/solicitar", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue({ limited: false, retryAfterSeconds: 0, restantes: 5 });
    mockMailer.mockResolvedValue(undefined);
  });

  it("returns 429 when rate limited", async () => {
    mockCheckRateLimit.mockResolvedValue({ limited: true, retryAfterSeconds: 20, restantes: 0 });
    const res = await POST(makeReq({ id_usuario: 2 }));
    expect(res.status).toBe(429);
  });

  it("returns 403 for a non-dueño", async () => {
    const res = await POST(makeReq({ id_usuario: 2 }, testUserEmpleado));
    expect(res.status).toBe(403);
  });

  it("returns 403 when unauthenticated", async () => {
    const req = createMockRequest("/api/usuarios/promover-dueno/solicitar", {
      method: "POST",
      body: { id_usuario: 2 },
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("rejects promoting yourself", async () => {
    const res = await POST(makeReq({ id_usuario: testUserDueno.id_usuario }));
    expect(res.status).toBe(400);
  });

  it("returns 404 when the target user doesn't exist", async () => {
    // Ambas consultas (objetivo y solicitante) corren en paralelo con
    // Promise.all, así que hay que mockear las dos aunque esta prueba solo
    // le importe la del objetivo.
    mockPool.query
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // SELECT objetivo
      .mockResolvedValueOnce({ rows: [solicitanteFila], rowCount: 1 }); // SELECT solicitante
    const res = await POST(makeReq({ id_usuario: 999 }));
    expect(res.status).toBe(404);
  });

  it("rejects when the target is already dueño", async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [{ ...objetivoValido, tipo_usuario: "DUENO" }] }) // objetivo
      .mockResolvedValueOnce({ rows: [solicitanteFila] }); // solicitante
    const res = await POST(makeReq({ id_usuario: 2 }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/ya es dueño/);
  });

  it("rejects when the target account is inactive", async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [{ ...objetivoValido, estado_usuario: false }] })
      .mockResolvedValueOnce({ rows: [solicitanteFila] });
    const res = await POST(makeReq({ id_usuario: 2 }));
    expect(res.status).toBe(400);
  });

  it(`rejects when there are already ${MAX_DUENOS} dueños`, async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [objetivoValido] }) // objetivo
      .mockResolvedValueOnce({ rows: [solicitanteFila] }) // solicitante
      .mockResolvedValueOnce({ rows: [{ count: MAX_DUENOS }] }); // conteo de dueños
    const res = await POST(makeReq({ id_usuario: 2 }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(new RegExp(`${MAX_DUENOS} usuarios dueño`));
    expect(mockMailer).not.toHaveBeenCalled();
  });

  it("generates a code, emails the requesting dueño, and returns a token", async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [objetivoValido] }) // objetivo
      .mockResolvedValueOnce({ rows: [solicitanteFila] }) // solicitante
      .mockResolvedValueOnce({ rows: [{ count: 1 }] }) // conteo de dueños (bajo el máximo)
      .mockResolvedValueOnce({ rows: [{ id_solicitud: 55 }] }); // INSERT solicitud

    const res = await POST(makeReq({ id_usuario: 2 }));
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(mockMailer).toHaveBeenCalledWith(testUserDueno.correo, expect.stringMatching(/^\d{6}$/), objetivoValido.nombre);
    expect(typeof data.token).toBe("string");
    expect(verifyPromocionToken(data.token)).toBe(55);
    expect(data.correo_enmascarado).toMatch(/\*/);
  });

  it("returns 502 when the email fails to send", async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [objetivoValido] })
      .mockResolvedValueOnce({ rows: [solicitanteFila] })
      .mockResolvedValueOnce({ rows: [{ count: 1 }] })
      .mockResolvedValueOnce({ rows: [{ id_solicitud: 55 }] });
    mockMailer.mockRejectedValue(new Error("smtp caído"));

    const res = await POST(makeReq({ id_usuario: 2 }));
    expect(res.status).toBe(502);
  });
});
