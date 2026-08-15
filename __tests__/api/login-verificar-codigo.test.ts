import bcrypt from "bcryptjs";
import { POST } from "@/app/api/login/verificar-codigo/route";
import { signPreToken } from "@/lib/verificacion";
import { testUserDueno } from "@/__tests__/utils/api-test-utils";
import { NextRequest } from "next/server";

jest.mock("bcryptjs");

jest.mock("@/lib/db", () => ({
  pool: { query: jest.fn(), connect: jest.fn() },
}));

const mockPool = jest.requireMock("@/lib/db").pool as { query: jest.Mock };
const mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

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
  beforeEach(() => jest.clearAllMocks());

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
    expect(typeof data.token).toBe("string");

    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toContain("auth_token=");

    const updateCall = mockPool.query.mock.calls[1][0] as string;
    expect(updateCall).toMatch(/usado = TRUE/);
  });
});