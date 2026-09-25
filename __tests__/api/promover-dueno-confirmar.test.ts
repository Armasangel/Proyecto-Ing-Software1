import bcrypt from "bcryptjs";
import { POST } from "@/app/api/usuarios/promover-dueno/confirmar/route";
import { createMockRequest, testUserDueno, testUserEmpleado } from "@/__tests__/utils/api-test-utils";
import { checkRateLimit } from "@/lib/api-rate-limit";
import { signPromocionToken } from "@/lib/verificacion";
import { MAX_DUENOS } from "@/lib/roles";

jest.mock("bcryptjs");

jest.mock("@/lib/db", () => ({
  pool: { query: jest.fn(), connect: jest.fn() },
}));

jest.mock("@/lib/api-rate-limit", () => ({
  checkRateLimit: jest.fn(),
  getClientIp: jest.fn(() => "1.2.3.4"),
}));

const mockPool = jest.requireMock("@/lib/db").pool as { connect: jest.Mock };
const mockCheckRateLimit = checkRateLimit as jest.MockedFunction<typeof checkRateLimit>;
const mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

function makeClient() {
  const client = {
    query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    release: jest.fn(),
  };
  mockPool.connect.mockResolvedValue(client);
  return client;
}

function makeReq(body: unknown, user = testUserDueno) {
  return createMockRequest("/api/usuarios/promover-dueno/confirmar", {
    method: "POST",
    user,
    body,
  });
}

const filaSolicitud = {
  id_solicitud: 55,
  id_usuario_objetivo: 2,
  id_dueno_solicitante: testUserDueno.id_usuario,
  codigo_hash: "hash-guardado",
  expira_en: new Date(Date.now() + 60_000).toISOString(),
  usado: false,
  intentos: 0,
};

// Encadena las respuestas de client.query en el orden en que las llama la
// ruta: BEGIN, advisory lock, SELECT solicitud (FOR UPDATE), ...
function encadenar(client: ReturnType<typeof makeClient>, respuestas: unknown[]) {
  let llamada = client.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // BEGIN
  llamada = llamada.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // advisory lock
  for (const r of respuestas) {
    llamada = llamada.mockResolvedValueOnce(r);
  }
}

describe("POST /api/usuarios/promover-dueno/confirmar", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue({ limited: false, retryAfterSeconds: 0, restantes: 10 });
  });

  it("returns 429 when rate limited", async () => {
    mockCheckRateLimit.mockResolvedValue({ limited: true, retryAfterSeconds: 5, restantes: 0 });
    const res = await POST(makeReq({ token: "x", codigo: "123456" }));
    expect(res.status).toBe(429);
  });

  it("returns 403 for a non-dueño", async () => {
    const res = await POST(makeReq({ token: "x", codigo: "123456" }, testUserEmpleado));
    expect(res.status).toBe(403);
  });

  it("returns 400 when token or codigo are missing", async () => {
    const res = await POST(makeReq({ token: "x" }));
    expect(res.status).toBe(400);
  });

  it("returns 401 for an invalid/expired token", async () => {
    const res = await POST(makeReq({ token: "no-es-un-jwt", codigo: "123456" }));
    expect(res.status).toBe(401);
  });

  it("returns 404 when the solicitud doesn't exist", async () => {
    const client = makeClient();
    encadenar(client, [{ rows: [], rowCount: 0 }]); // SELECT solicitud vacío
    const token = signPromocionToken(55);
    const res = await POST(makeReq({ token, codigo: "123456" }));
    expect(res.status).toBe(404);
    expect(client.query).toHaveBeenCalledWith("ROLLBACK");
    expect(client.release).toHaveBeenCalled();
  });

  it("returns 403 when a different dueño tries to confirm someone else's solicitud", async () => {
    const client = makeClient();
    encadenar(client, [{ rows: [{ ...filaSolicitud, id_dueno_solicitante: 999 }], rowCount: 1 }]);
    const token = signPromocionToken(55);
    const res = await POST(makeReq({ token, codigo: "123456" }));
    expect(res.status).toBe(403);
    expect(client.query).toHaveBeenCalledWith("ROLLBACK");
  });

  it("returns 400 when the solicitud was already used", async () => {
    const client = makeClient();
    encadenar(client, [{ rows: [{ ...filaSolicitud, usado: true }], rowCount: 1 }]);
    const token = signPromocionToken(55);
    const res = await POST(makeReq({ token, codigo: "123456" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when the code expired", async () => {
    const client = makeClient();
    encadenar(client, [
      { rows: [{ ...filaSolicitud, expira_en: new Date(Date.now() - 1000).toISOString() }], rowCount: 1 },
    ]);
    const token = signPromocionToken(55);
    const res = await POST(makeReq({ token, codigo: "123456" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/expiró/);
  });

  it("returns 429 after too many failed attempts", async () => {
    const client = makeClient();
    encadenar(client, [{ rows: [{ ...filaSolicitud, intentos: 5 }], rowCount: 1 }]);
    const token = signPromocionToken(55);
    const res = await POST(makeReq({ token, codigo: "123456" }));
    expect(res.status).toBe(429);
  });

  it("returns 401 and increments intentos when the code is wrong", async () => {
    const client = makeClient();
    encadenar(client, [
      { rows: [filaSolicitud], rowCount: 1 }, // SELECT solicitud
      { rows: [], rowCount: 0 }, // UPDATE intentos + 1
    ]);
    mockBcrypt.compareSync.mockReturnValue(false);
    const token = signPromocionToken(55);
    const res = await POST(makeReq({ token, codigo: "000000" }));
    expect(res.status).toBe(401);
    const intentosCall = client.query.mock.calls.find((c) => (c[0] as string).includes("intentos + 1"));
    expect(intentosCall).toBeDefined();
    expect(client.query).toHaveBeenCalledWith("COMMIT");
  });

  it(`rejects with a correct code when there are already ${MAX_DUENOS} dueños`, async () => {
    const client = makeClient();
    encadenar(client, [
      { rows: [filaSolicitud], rowCount: 1 }, // SELECT solicitud
      { rows: [{ count: MAX_DUENOS }], rowCount: 1 }, // conteo de dueños
    ]);
    mockBcrypt.compareSync.mockReturnValue(true);
    const token = signPromocionToken(55);
    const res = await POST(makeReq({ token, codigo: "123456" }));
    expect(res.status).toBe(400);
    expect(client.query).toHaveBeenCalledWith("ROLLBACK");
  });

  it("applies the promotion and marks the solicitud as used when everything checks out", async () => {
    const client = makeClient();
    encadenar(client, [
      { rows: [filaSolicitud], rowCount: 1 }, // SELECT solicitud
      { rows: [{ count: 1 }], rowCount: 1 }, // conteo de dueños (bajo el máximo)
      { rows: [{ tipo_usuario: "EMPLEADO", estado_usuario: true }], rowCount: 1 }, // SELECT objetivo FOR UPDATE
      {
        rows: [
          {
            id_usuario: 2,
            nombre: "María López",
            correo: "maria@tienda.com",
            tipo_usuario: "DUENO",
            estado_usuario: true,
            id_bodega: null,
            requiere_2fa: true,
          },
        ],
        rowCount: 1,
      }, // UPDATE usuario
      { rows: [], rowCount: 0 }, // UPDATE solicitud usado = TRUE
    ]);
    mockBcrypt.compareSync.mockReturnValue(true);

    const token = signPromocionToken(55);
    const res = await POST(makeReq({ token, codigo: "123456" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.usuario.tipo_usuario).toBe("DUENO");

    expect(client.query).toHaveBeenCalledWith("COMMIT");
    const updateCall = client.query.mock.calls.find((c) => (c[0] as string).includes("SET tipo_usuario"));
    expect(updateCall).toBeDefined();
    const usadoCall = client.query.mock.calls.find((c) => (c[0] as string).includes("usado = TRUE"));
    expect(usadoCall).toBeDefined();
  });
});
