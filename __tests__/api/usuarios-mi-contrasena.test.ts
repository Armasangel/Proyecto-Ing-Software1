import { NextRequest } from "next/server";
import { PATCH } from "@/app/api/usuarios/mi-contrasena/route";
import { checkRateLimit } from "@/lib/api-rate-limit";
import { createMockRequest, testUserDueno } from "@/__tests__/utils/api-test-utils";

jest.mock("bcryptjs");

jest.mock("@/lib/db", () => ({
  pool: { query: jest.fn() },
}));

jest.mock("@/lib/api-rate-limit", () => ({
  ...jest.requireActual("@/lib/api-rate-limit"),
  checkRateLimit: jest.fn(),
}));

jest.mock("@/lib/mailer", () => ({
  enviarAvisoCambioContrasena: jest.fn().mockResolvedValue(undefined),
}));

const mockPool = jest.requireMock("@/lib/db").pool as { query: jest.Mock };
const mockCheckRateLimit = checkRateLimit as jest.MockedFunction<typeof checkRateLimit>;

// Cumplen lib/password-policy.ts
const ACTUAL = "Brindis-GT-2026!";
const NUEVA = "San-Miguel-2026!";

function makeReq(body: unknown) {
  return createMockRequest("/api/usuarios/mi-contrasena", {
    method: "PATCH",
    body,
    user: testUserDueno,
    headers: { "x-forwarded-for": "203.0.113.5" },
  });
}

describe("PATCH /api/usuarios/mi-contrasena", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue({ limited: false, retryAfterSeconds: 0, restantes: 5 });
    mockPool.query.mockResolvedValue({ rowCount: 0, rows: [] });
  });

  it("cambia la contraseña, revoca sesiones y avisa al correo", async () => {
    const bcrypt = jest.requireMock("bcryptjs");
    // 1er compare = contraseña actual (correcta), 2º = ¿la nueva es distinta?
    bcrypt.compareSync.mockReturnValueOnce(true).mockReturnValueOnce(false);
    bcrypt.hashSync.mockReturnValue("hash-nuevo");

    mockPool.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ correo: testUserDueno.correo, nombre: "Dueño", contrasena_hash: "hash-viejo" }],
    });

    const res = await PATCH(
      makeReq({ contrasena_actual: ACTUAL, nueva_contrasena: NUEVA })
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.mensaje).toMatch(/cerraron todas tus sesiones/i);

    const sqls = mockPool.query.mock.calls.map((c) => c[0] as string);
    const update = sqls.find((q) => q.includes("UPDATE usuario"))!;
    // La sesión se revoca dentro del MISMO UPDATE: cambiar la contraseña
    // tiene que cortar los tokens viejos sí o sí.
    expect(update).toContain("sesion_version = sesion_version + 1");
    expect(update).toContain("requiere_cambio_contrasena = FALSE");
  });

  it("exige la contraseña actual", async () => {
    const bcrypt = jest.requireMock("bcryptjs");
    bcrypt.compareSync.mockReturnValue(false);

    mockPool.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ correo: testUserDueno.correo, nombre: "Dueño", contrasena_hash: "hash-viejo" }],
    });

    const res = await PATCH(
      makeReq({ contrasena_actual: "incorrecta", nueva_contrasena: NUEVA })
    );
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toMatch(/no es correcta/i);
    // Nunca se escribe la contraseña nueva si la actual no cuadra.
    const sqls = mockPool.query.mock.calls.map((c) => c[0] as string);
    expect(sqls.some((q) => q.includes("UPDATE usuario"))).toBe(false);

    // Queda registrado como intento fallido, con su propio tipo de evento:
    // en el panel, "Contraseña cambiada" tiene que significar que se cambió.
    const auditoria = sqls.findIndex((q) => q.includes("INSERT INTO auditoria"));
    expect(auditoria).toBeGreaterThanOrEqual(0);
    expect(mockPool.query.mock.calls[auditoria][1][2]).toBe("PASSWORD_CAMBIO_RECHAZADO");
  });

  it("rechaza contraseñas que no cumplen la política", async () => {
    const res = await PATCH(
      makeReq({ contrasena_actual: ACTUAL, nueva_contrasena: "123456" })
    );
    expect(res.status).toBe(400);
    // La política se valida ANTES de tocar la base: ni un SELECT.
    expect(mockPool.query).not.toHaveBeenCalled();
  });

  it("rechaza reutilizar la misma contraseña", async () => {
    const bcrypt = jest.requireMock("bcryptjs");
    bcrypt.compareSync.mockReturnValue(true);

    mockPool.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ correo: testUserDueno.correo, nombre: "Dueño", contrasena_hash: "hash-viejo" }],
    });

    const res = await PATCH(
      makeReq({ contrasena_actual: ACTUAL, nueva_contrasena: NUEVA })
    );
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toMatch(/distinta/i);
  });

  // 403 y no 401: es lo que devuelve `unauthorizedError()` en todo el código.
  // Un 401 sólo para este endpoint haría confuso el manejo de errores del cliente.
  it("rechaza a quien no tiene sesión", async () => {
    const res = await new NextRequest(new URL("/api/usuarios/mi-contrasena", "http://localhost"), {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ contrasena_actual: ACTUAL, nueva_contrasena: NUEVA }),
    });

    const salida = await PATCH(res);
    expect(salida.status).toBe(403);
  });

  it("devuelve 429 cuando se excede el límite de intentos", async () => {
    mockCheckRateLimit.mockResolvedValue({ limited: true, retryAfterSeconds: 300, restantes: 0 });

    const res = await PATCH(
      makeReq({ contrasena_actual: ACTUAL, nueva_contrasena: NUEVA })
    );

    expect(res.status).toBe(429);
    expect(mockPool.query).not.toHaveBeenCalled();
  });
});