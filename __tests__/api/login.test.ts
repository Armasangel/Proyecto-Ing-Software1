import bcrypt from "bcryptjs";
import { POST } from "@/app/api/login/route";
import { createMockRequest, testUserDueno } from "@/__tests__/utils/api-test-utils";
import { resetLoginRateLimitStore } from "@/lib/login-rate-limit";

jest.mock("bcryptjs");

jest.mock("@/lib/db", () => ({
  pool: { query: jest.fn(), connect: jest.fn() },
}));

const mockPool = jest.requireMock("@/lib/db").pool as { query: jest.Mock };
const mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

const mockDbRow = {
  id_usuario: testUserDueno.id_usuario,
  nombre: testUserDueno.nombre,
  correo: testUserDueno.correo,
  tipo_usuario: testUserDueno.tipo_usuario,
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

  it("returns 200 with token and user on success", async () => {
    mockPool.query.mockResolvedValue({ rows: [mockDbRow], rowCount: 1 });
    mockBcrypt.compareSync.mockReturnValue(true);
    const req = createMockRequest("/api/login", {
      method: "POST",
      body: { username: "juan@tienda.com", password: "correcta" },
    });
    const res = await POST(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(typeof data.token).toBe("string");
    expect(data.usuario).toMatchObject({
      id_usuario: testUserDueno.id_usuario,
      nombre: testUserDueno.nombre,
      correo: testUserDueno.correo,
      tipo_usuario: testUserDueno.tipo_usuario,
    });
  });

  it("sets the auth_token cookie on success", async () => {
    mockPool.query.mockResolvedValue({ rows: [mockDbRow], rowCount: 1 });
    mockBcrypt.compareSync.mockReturnValue(true);
    const req = createMockRequest("/api/login", {
      method: "POST",
      body: { username: "juan@tienda.com", password: "correcta" },
    });
    const res = await POST(req);
    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toContain("auth_token=");
    expect(setCookie).toContain("Max-Age=28800");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Path=/");
  });

  it("blocks the 6th failed login from the same IP within 1 minute", async () => {
    mockPool.query.mockResolvedValue({ rows: [mockDbRow], rowCount: 1 });
    mockBcrypt.compareSync.mockReturnValue(false);

    for (let i = 0; i < 5; i++) {
      const res = await POST(failedLoginRequest());
      expect(res.status).toBe(401);
    }

    const blocked = await POST(failedLoginRequest());
    const data = await blocked.json();
    expect(blocked.status).toBe(429);
    expect(data.error).toBe("Demasiados intentos. Intenta de nuevo en un minuto.");
  });

  it("does not rate-limit a different IP after another IP is blocked", async () => {
    mockPool.query.mockResolvedValue({ rows: [mockDbRow], rowCount: 1 });
    mockBcrypt.compareSync.mockReturnValue(false);

    for (let i = 0; i < 5; i++) {
      await POST(failedLoginRequest("203.0.113.10"));
    }

    const blocked = await POST(failedLoginRequest("203.0.113.10"));
    expect(blocked.status).toBe(429);

    const otherIp = await POST(failedLoginRequest("198.51.100.20"));
    expect(otherIp.status).toBe(401);
  });

  it("clears failed attempts after a successful login", async () => {
    mockPool.query.mockResolvedValue({ rows: [mockDbRow], rowCount: 1 });
    mockBcrypt.compareSync.mockReturnValue(false);

    for (let i = 0; i < 3; i++) {
      const res = await POST(failedLoginRequest());
      expect(res.status).toBe(401);
    }

    mockBcrypt.compareSync.mockReturnValue(true);
    const success = await POST(
      createMockRequest("/api/login", {
        method: "POST",
        body: { username: "juan@tienda.com", password: "correcta" },
        headers: { "x-forwarded-for": "203.0.113.10" },
      })
    );
    expect(success.status).toBe(200);

    mockBcrypt.compareSync.mockReturnValue(false);
    const afterClear = await POST(failedLoginRequest());
    expect(afterClear.status).toBe(401);
  });
});
