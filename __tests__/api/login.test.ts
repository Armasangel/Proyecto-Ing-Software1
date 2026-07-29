import bcrypt from "bcryptjs";
import { POST } from "@/app/api/login/route";
import { createMockRequest, testUserDueno } from "@/__tests__/utils/api-test-utils";

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

describe("POST /api/login", () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
});
