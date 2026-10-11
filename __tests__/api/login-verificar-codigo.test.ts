import bcrypt from "bcryptjs";
import { POST } from "@/app/api/login/verificar-codigo/route";
import { checkRateLimit } from "@/lib/api-rate-limit";
import { signPreToken } from "@/lib/verificacion";
import { testUserDueno } from "@/__tests__/utils/api-test-utils";
import { NextRequest } from "next/server";

jest.mock("bcryptjs");

jest.mock("@/lib/db", () => ({
  pool: { query: jest.fn(), connect: jest.fn() },
}));

// Mockeado para no alterar el orden de las llamadas a pool.query que el resto
// del test define con mockResolvedValueOnce. El límite en sí se prueba con
// un caso dedicado más abajo.
jest.mock("@/lib/api-rate-limit", () => ({
  ...jest.requireActual("@/lib/api-rate-limit"),
  checkRateLimit: jest.fn(),
}));

const mockPool = jest.requireMock("@/lib/db").pool as { query: jest.Mock };
const mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;
const mockCheckRateLimit = checkRateLimit as jest.MockedFunction<typeof checkRateLimit>;

function makeReq(body: unknown) {
  return new NextRequest(new URL("/api/login/verificar-codigo", "http://localhost"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const filaVigente = {
  id_codigo: 1,
  codigo_hash: "hash-guardado",
  expira_en: new Date(Date.now() + 60_000).toISOString(),
  usado: false,
  intentos: 0,
};

describe("POST /api/login/verificar-codigo (paso 2)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue({ limited: false, retryAfterSeconds: 0, restantes: 5 });
  });

  it("returns 429 when too many 2FA attempts are made", async () => {
    // El contador por código (5 intentos) no alcanzaba solo: pidiendo un
    // código nuevo se reiniciaba. Este límite cierra ese hueco.
    mockCheckRateLimit.mockResolvedValue({ limited: true, retryAfterSeconds: 200, restantes: 0 });
    const preToken = signPreToken(testUserDueno.id_usuario);
    const res = await POST(makeReq({ pre_token: preToken, codigo: "123456" }));
    expect(res.status).toBe(429);
    // Ni una consulta al código: el bloqueo corta antes de tocar la base.
    expect(mockPool.query).not.toHaveBeenCalled();
  });

  it("aplica el límite tanto por IP como por cuenta", async () => {
    mockPool.query.mockResolvedValue({ rows: [] });
    await POST(
      makeReq({ pre_token: signPreToken(testUserDueno.id_usuario), codigo: "123456" })
    );

    const claves = mockCheckRateLimit.mock.calls.map((call) => call[0]);
    expect(claves.some((clave: string) => clave.startsWith("login2fa:ip:"))).toBe(true);
    expect(claves.some((clave: string) => clave.includes(`login2fa:acct:${testUserDueno.id_usuario}`))).toBe(true);
  });

  it("returns 400 when fields are missing", async () => {
    const res = await POST(makeReq({}));
    expect(res.status).toBe(400);
  });

  it("returns 401 with an invalid/expired pre_token", async () => {
    const res = await POST(makeReq({ pre_token: "token-invalido", codigo: "123456" }));
    const data = await res.json();
    expect(res.status).toBe(401);
    expect(data.error).toMatch(/expiró/i);
  });

  it("returns 400 if there is no pending code for the user", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });
    const preToken = signPreToken(testUserDueno.id_usuario);
    const res = await POST(makeReq({ pre_token: preToken, codigo: "123456" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 if the code already expired", async () => {
    mockPool.query.mockResolvedValueOnce({
      rows: [{ ...filaVigente, expira_en: new Date(Date.now() - 1000).toISOString() }],
    });
    const preToken = signPreToken(testUserDueno.id_usuario);
    const res = await POST(makeReq({ pre_token: preToken, codigo: "123456" }));
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toMatch(/expiró/i);
  });

  it("returns 429 after too many failed attempts", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [{ ...filaVigente, intentos: 5 }] });
    const preToken = signPreToken(testUserDueno.id_usuario);
    const res = await POST(makeReq({ pre_token: preToken, codigo: "123456" }));
    expect(res.status).toBe(429);
  });

  it("returns 401 and increments 'intentos' when the code is wrong", async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [filaVigente] }) // SELECT codigo_verificacion
      .mockResolvedValueOnce({ rows: [] }); // UPDATE intentos + 1
    mockBcrypt.compareSync.mockReturnValue(false);

    const preToken = signPreToken(testUserDueno.id_usuario);
    const res = await POST(makeReq({ pre_token: preToken, codigo: "000000" }));
    expect(res.status).toBe(401);

    const updateCall = mockPool.query.mock.calls[1][0] as string;
    expect(updateCall).toMatch(/intentos = intentos \+ 1/);
  });

  it("returns 200, sets the auth cookie, and marks the code as used when correct", async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [filaVigente] }) // SELECT codigo_verificacion
      .mockResolvedValueOnce({ rows: [] }) // UPDATE usado = TRUE
      .mockResolvedValueOnce({
        rows: [
          {
            id_usuario: testUserDueno.id_usuario,
            nombre: testUserDueno.nombre,
            correo: testUserDueno.correo,
            tipo_usuario: testUserDueno.tipo_usuario,
          },
        ],
      }); // SELECT usuario
    mockBcrypt.compareSync.mockReturnValue(true);

    const preToken = signPreToken(testUserDueno.id_usuario);
    const res = await POST(makeReq({ pre_token: preToken, codigo: "123456" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    // El token de sesión solo viaja en la cookie httpOnly: nunca en el cuerpo.
    expect(data.token).toBeUndefined();

    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toContain("auth_token=");

    const updateCall = mockPool.query.mock.calls[1][0] as string;
    expect(updateCall).toMatch(/usado = TRUE/);
  });
});