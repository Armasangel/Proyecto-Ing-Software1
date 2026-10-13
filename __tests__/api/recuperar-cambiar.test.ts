import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/recuperar/cambiar/route";
import { checkRateLimit } from "@/lib/api-rate-limit";
import { clearFailedLogins } from "@/lib/login-rate-limit";
import { signResetToken } from "@/lib/verificacion";
import { testUserDueno } from "@/__tests__/utils/api-test-utils";

jest.mock("bcryptjs");

jest.mock("@/lib/db", () => ({
  pool: { query: jest.fn() },
}));

jest.mock("@/lib/api-rate-limit", () => ({
  ...jest.requireActual("@/lib/api-rate-limit"),
  checkRateLimit: jest.fn(),
}));

jest.mock("@/lib/login-rate-limit", () => ({
  ...jest.requireActual("@/lib/login-rate-limit"),
  clearFailedLogins: jest.fn(),
}));

jest.mock("@/lib/mailer", () => ({
  enviarAvisoCambioContrasena: jest.fn(),
}));

const mockPool = jest.requireMock("@/lib/db").pool as { query: jest.Mock };
const mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;
const mockCheckRateLimit = checkRateLimit as jest.MockedFunction<typeof checkRateLimit>;
const mockClearFailedLogins = clearFailedLogins as jest.MockedFunction<typeof clearFailedLogins>;

// Cumple la política de lib/password-policy.ts (12+ caracteres, no común).
const CONTRASENA_VALIDA = "Brindis-GT-2026!";

function makeReq(body: unknown, ip = "203.0.113.10") {
  return new NextRequest(new URL("/api/recuperar/cambiar", "http://localhost"), {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

describe("POST /api/recuperar/cambiar (paso 3)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue({ limited: false, retryAfterSeconds: 0, restantes: 5 });
  });

  it("returns 400 when token or password are missing", async () => {
    const res = await POST(makeReq({}));
    expect(res.status).toBe(400);
  });

  it("returns 400 when the password is shorter than the minimum length", async () => {
    const res = await POST(makeReq({ reset_token: signResetToken(testUserDueno.id_usuario), nueva_contrasena: "12345" }));
    expect(res.status).toBe(400);
  });

  it("rechaza contraseñas más largas de 72 bytes (límite de bcrypt)", async () => {
    // bcrypt ignora todo lo que pase de los primeros 72 bytes, así que dos
    // contraseñas que compartan ese prefijo serían idénticas para el login.
    const res = await POST(
      makeReq({
        reset_token: signResetToken(testUserDueno.id_usuario),
        nueva_contrasena: "a".repeat(80),
      })
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("72 bytes");
  });

  it("rechaza contraseñas comunes", async () => {
    const res = await POST(
      makeReq({ reset_token: signResetToken(testUserDueno.id_usuario), nueva_contrasena: "password123456" })
    );
    expect(res.status).toBe(400);
  });

  it("returns 401 for an invalid/expired reset token", async () => {
    const res = await POST(makeReq({ reset_token: "token-invalido", nueva_contrasena: CONTRASENA_VALIDA }));
    expect(res.status).toBe(401);
  });

  it("returns 429 when the rate limit is exceeded", async () => {
    mockCheckRateLimit.mockResolvedValue({ limited: true, retryAfterSeconds: 120, restantes: 0 });
    const res = await POST(makeReq({ reset_token: signResetToken(testUserDueno.id_usuario), nueva_contrasena: CONTRASENA_VALIDA }));
    expect(res.status).toBe(429);
  });

  it("returns 404 when the token belongs to a missing/disabled user", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] }); // SELECT usuario
    const res = await POST(makeReq({ reset_token: signResetToken(testUserDueno.id_usuario), nueva_contrasena: CONTRASENA_VALIDA }));
    expect(res.status).toBe(404);
  });

  it("updates the password hash, invalidates pending codes and clears failed logins", async () => {
    mockPool.query.mockResolvedValue({ rowCount: 0, rows: [] });
    mockPool.query.mockResolvedValueOnce({
      rows: [{ id_usuario: testUserDueno.id_usuario, correo: "dueno@tienda.com", nombre: "Dueño" }],
    }); // SELECT usuario
    mockPool.query.mockResolvedValueOnce({ rowCount: 1, rows: [] }); // UPDATE usuario
    mockPool.query.mockResolvedValueOnce({ rowCount: 0, rows: [] }); // DELETE codigo_recuperacion
    mockPool.query.mockResolvedValueOnce({ rowCount: 0, rows: [] }); // DELETE codigo_verificacion
    mockBcrypt.hashSync.mockReturnValueOnce("nuevo-hash");

    const res = await POST(makeReq({ reset_token: signResetToken(testUserDueno.id_usuario), nueva_contrasena: CONTRASENA_VALIDA }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);

    const updateSql = mockPool.query.mock.calls[1][0] as string;
    expect(updateSql).toMatch(/UPDATE usuario/);
    expect(updateSql).toMatch(/contrasena_hash = \$1/);
    // Al cambiar la contraseña se levanta la exigencia de cambiarla, que
    // puede venir activada por una contraseña conocida (ver migración 06).
    expect(updateSql).toMatch(/requiere_cambio_contrasena = FALSE/);
    expect(mockPool.query.mock.calls[1][1]).toEqual(["nuevo-hash", testUserDueno.id_usuario]);

    const deleteRecuperacion = mockPool.query.mock.calls[2][0] as string;
    expect(deleteRecuperacion).toMatch(/DELETE FROM codigo_recuperacion/);
    const delete2fa = mockPool.query.mock.calls[3][0] as string;
    expect(delete2fa).toMatch(/DELETE FROM codigo_verificacion/);

    expect(mockClearFailedLogins).toHaveBeenCalled();
  });
});