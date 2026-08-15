import bcrypt from "bcryptjs";
import { POST } from "@/app/api/login/route";
import { createMockRequest, testUserDueno, testUserEmpleado } from "@/__tests__/utils/api-test-utils";
import {
  clearFailedLogins,
  isLoginRateLimited,
  recordFailedLogin,
  resetLoginRateLimitStore,
} from "@/lib/login-rate-limit";

jest.mock("bcryptjs");

jest.mock("@/lib/db", () => ({
  pool: { query: jest.fn(), connect: jest.fn() },
}));

// El rate-limit real se prueba en __tests__/lib/login-rate-limit.test.ts.
// Aquí se mockea para verificar solo la integración de la ruta con el módulo.
jest.mock("@/lib/login-rate-limit", () => ({
  ...jest.requireActual("@/lib/login-rate-limit"),
  isLoginRateLimited: jest.fn(),
  recordFailedLogin: jest.fn(),
  clearFailedLogins: jest.fn(),
  resetLoginRateLimitStore: jest.fn(),
}));

jest.mock("@/lib/mailer", () => ({
  enviarCodigoVerificacion: jest.fn(),
}));

const mockPool = jest.requireMock("@/lib/db").pool as { query: jest.Mock };
const mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;
const mockMailer = jest.requireMock("@/lib/mailer") as { enviarCodigoVerificacion: jest.Mock };

const mockDbRow = {
  id_usuario: testUserDueno.id_usuario,
  nombre: testUserDueno.nombre,
  correo: testUserDueno.correo,
  tipo_usuario: testUserDueno.tipo_usuario,
  contrasena_hash: "$2a$04$mocked",
};

// El 2FA solo aplica a colaboradores (EMPLEADO); el dueño entra directo.
const mockDbEmpleado = {
  id_usuario: testUserEmpleado.id_usuario,
  nombre: testUserEmpleado.nombre,
  correo: testUserEmpleado.correo,
  tipo_usuario: testUserEmpleado.tipo_usuario,
  contrasena_hash: "$2a$04$mocked",
};

function failedLoginRequest(ip = "203.0.113.10") {
  return createMockRequest("/api/login", {
    method: "POST",
    body: { username: "juan@tienda.com", password: "wrong" },
    headers: { "x-forwarded-for": ip },
  });
}

describe("POST /api/login", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetLoginRateLimitStore();
    (isLoginRateLimited as jest.Mock).mockResolvedValue(false);
  });

  it("returns 400 when username is missing", async () => {
    const req = createMockRequest("/api/login", {
      method: "POST",
      body: { password: "test123" },
    });
    const res = await POST(req);
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toBe("Usuario y contraseña son obligatorios");
  });

  it("returns 400 when password is missing", async () => {
    const req = createMockRequest("/api/login", {
      method: "POST",
      body: { username: "test@test.com" },
    });
    const res = await POST(req);
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toBe("Usuario y contraseña son obligatorios");
  });

  it("returns 401 when credentials are incorrect (no user found)", async () => {
    mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });
    const req = createMockRequest("/api/login", {
      method: "POST",
      body: { username: "unknown@test.com", password: "test123" },
    });
    const res = await POST(req);
    const data = await res.json();
    expect(res.status).toBe(401);
    expect(data.error).toBe("Credenciales incorrectas");
  });

  it("returns 401 when password does not match", async () => {
    mockPool.query.mockResolvedValue({ rows: [mockDbRow], rowCount: 1 });
    mockBcrypt.compareSync.mockReturnValue(false);
    const req = createMockRequest("/api/login", {
      method: "POST",
      body: { username: "juan@tienda.com", password: "wrong" },
    });
    const res = await POST(req);
    const data = await res.json();
    expect(res.status).toBe(401);
    expect(data.error).toBe("Credenciales incorrectas");
  });

  it("on correct credentials, does NOT set the auth cookie yet — sends a code instead", async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [mockDbEmpleado], rowCount: 1 }) // SELECT usuario
      .mockResolvedValueOnce({ rows: [], rowCount: 1 }); // INSERT codigo_verificacion
    mockBcrypt.compareSync.mockReturnValue(true);

    const req = createMockRequest("/api/login", {
      method: "POST",
      body: { username: "juan@tienda.com", password: "correcta" },
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.requiere_verificacion).toBe(true);
    expect(typeof data.pre_token).toBe("string");
    expect(data.correo_enmascarado).toContain("@");
    expect(data.token).toBeUndefined(); // el AUTH token real todavía no se entrega

    const setCookie = res.headers.get("set-cookie");
    expect(setCookie ?? "").not.toContain("auth_token=");

    expect(mockMailer.enviarCodigoVerificacion).toHaveBeenCalledTimes(1);
    expect(mockMailer.enviarCodigoVerificacion).toHaveBeenCalledWith(
      mockDbEmpleado.correo,
      expect.stringMatching(/^\d{6}$/)
    );
  });

  it("returns 502 if sending the email fails", async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [mockDbEmpleado], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 });
    mockBcrypt.compareSync.mockReturnValue(true);
    mockMailer.enviarCodigoVerificacion.mockRejectedValue(new Error("SMTP down"));

    const req = createMockRequest("/api/login", {
      method: "POST",
      body: { username: "juan@tienda.com", password: "correcta" },
    });
    const res = await POST(req);
    expect(res.status).toBe(502);
  });

  it("returns 429 when the rate limiter marks the IP as blocked", async () => {
    (isLoginRateLimited as jest.Mock).mockResolvedValue(true);
    const blocked = await POST(failedLoginRequest());
    const data = await blocked.json();
    expect(blocked.status).toBe(429);
    expect(data.error).toBe("Demasiados intentos. Intenta de nuevo en un minuto.");
  });

  it("passes the client IP from x-forwarded-for to the rate limiter", async () => {
    mockPool.query.mockResolvedValue({ rows: [mockDbRow], rowCount: 1 });
    mockBcrypt.compareSync.mockReturnValue(false);

    await POST(failedLoginRequest("203.0.113.50"));
    expect(isLoginRateLimited).toHaveBeenCalledWith("203.0.113.50");
    expect(recordFailedLogin).toHaveBeenCalledWith("203.0.113.50");
  });

  it("records a failed login when the password is wrong", async () => {
    mockPool.query.mockResolvedValue({ rows: [mockDbRow], rowCount: 1 });
    mockBcrypt.compareSync.mockReturnValue(false);

    await POST(failedLoginRequest());
    expect(recordFailedLogin).toHaveBeenCalledTimes(1);
    expect(recordFailedLogin).toHaveBeenCalledWith("203.0.113.10");
  });

  it("clears failed attempts after a successful login", async () => {
    mockPool.query.mockResolvedValue({ rows: [mockDbRow], rowCount: 1 });
    mockBcrypt.compareSync.mockReturnValue(false);

    await POST(failedLoginRequest());
    expect(recordFailedLogin).toHaveBeenCalledTimes(1);

    mockBcrypt.compareSync.mockReturnValue(true);
    const success = await POST(
      createMockRequest("/api/login", {
        method: "POST",
        body: { username: "juan@tienda.com", password: "correcta" },
        headers: { "x-forwarded-for": "203.0.113.10" },
      })
    );
    expect(success.status).toBe(200);
    expect(clearFailedLogins).toHaveBeenCalledWith("203.0.113.10");
  });
});
