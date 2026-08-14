import bcrypt from "bcryptjs";
import { POST } from "@/app/api/login/route";
import { createMockRequest, testUserDueno } from "@/__tests__/utils/api-test-utils";

jest.mock("bcryptjs");

jest.mock("@/lib/db", () => ({
  pool: { query: jest.fn(), connect: jest.fn() },
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

describe("POST /api/login (paso 1: usuario + contraseña)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBcrypt.hashSync.mockReturnValue("codigo-hasheado" as unknown as string);
    mockMailer.enviarCodigoVerificacion.mockResolvedValue(undefined);
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
      .mockResolvedValueOnce({ rows: [mockDbRow], rowCount: 1 }) // SELECT usuario
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
      mockDbRow.correo,
      expect.stringMatching(/^\d{6}$/)
    );
  });

  it("returns 502 if sending the email fails", async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [mockDbRow], rowCount: 1 })
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
});