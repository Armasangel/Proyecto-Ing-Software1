import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/recuperar/verificar/route";
import { testUserDueno } from "@/__tests__/utils/api-test-utils";

jest.mock("bcryptjs");

jest.mock("@/lib/db", () => ({
  pool: { query: jest.fn() },
}));

const mockPool = jest.requireMock("@/lib/db").pool as { query: jest.Mock };
const mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

function makeReq(body: unknown) {
  return new NextRequest(new URL("/api/recuperar/verificar", "http://localhost"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const filaVigente = {
  id_recuperacion: 1,
  codigo_hash: "hash-guardado",
  expira_en: new Date(Date.now() + 60_000).toISOString(),
  usado: false,
  intentos: 0,
};

describe("POST /api/recuperar/verificar (paso 2)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 400 when fields are missing", async () => {
    const res = await POST(makeReq({}));
    expect(res.status).toBe(400);
  });

  it("returns a generic 400 for an email that is not registered", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] }); // SELECT usuario
    const res = await POST(makeReq({ correo: "nadie@tienda.com", codigo: "123456" }));
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(String(data.error)).toMatch(/código incorrecto/i);
  });

  it("returns 400 if there is no pending recovery code", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [{ id_usuario: testUserDueno.id_usuario }] });
    mockPool.query.mockResolvedValueOnce({ rows: [] }); // SELECT codigo_recuperacion
    const res = await POST(makeReq({ correo: testUserDueno.correo, codigo: "123456" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 if the code was already used", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [{ id_usuario: testUserDueno.id_usuario }] });
    mockPool.query.mockResolvedValueOnce({ rows: [{ ...filaVigente, usado: true }] });
    const res = await POST(makeReq({ correo: testUserDueno.correo, codigo: "123456" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 if the code expired", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [{ id_usuario: testUserDueno.id_usuario }] });
    mockPool.query.mockResolvedValueOnce({
      rows: [{ ...filaVigente, expira_en: new Date(Date.now() - 1000).toISOString() }],
    });
    const res = await POST(makeReq({ correo: testUserDueno.correo, codigo: "123456" }));
    expect(res.status).toBe(400);
  });

  it("returns 429 after too many failed attempts", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [{ id_usuario: testUserDueno.id_usuario }] });
    mockPool.query.mockResolvedValueOnce({ rows: [{ ...filaVigente, intentos: 5 }] });
    const res = await POST(makeReq({ correo: testUserDueno.correo, codigo: "123456" }));
    expect(res.status).toBe(429);
  });

  it("returns 401 and increments 'intentos' when the code is wrong", async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [{ id_usuario: testUserDueno.id_usuario }] }) // SELECT usuario
      .mockResolvedValueOnce({ rows: [filaVigente] }) // SELECT codigo_recuperacion
      .mockResolvedValueOnce({ rows: [] }); // UPDATE intentos + 1
    mockBcrypt.compareSync.mockReturnValue(false);

    const res = await POST(makeReq({ correo: testUserDueno.correo, codigo: "000000" }));
    expect(res.status).toBe(401);

    const updateCall = mockPool.query.mock.calls[2][0] as string;
    expect(updateCall).toMatch(/intentos = intentos \+ 1/);
  });

  it("returns 200 with a reset_token and marks the code as used when correct", async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [{ id_usuario: testUserDueno.id_usuario }] }) // SELECT usuario
      .mockResolvedValueOnce({ rows: [filaVigente] }) // SELECT codigo_recuperacion
      .mockResolvedValueOnce({ rows: [] }); // UPDATE usado = TRUE
    mockBcrypt.compareSync.mockReturnValue(true);

    const res = await POST(makeReq({ correo: testUserDueno.correo, codigo: "123456" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(typeof data.reset_token).toBe("string");

    const updateCall = mockPool.query.mock.calls[2][0] as string;
    expect(updateCall).toMatch(/usado = TRUE/);
  });
});