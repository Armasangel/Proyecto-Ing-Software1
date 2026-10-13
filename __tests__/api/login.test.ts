import bcrypt from "bcryptjs";
import { POST } from "@/app/api/login/route";
import { createMockRequest, testUserDueno, testUserEmpleado } from "@/__tests__/utils/api-test-utils";
import {
  ACCOUNT_LOCKOUT_MAX,
  ACCOUNT_LOCKOUT_WINDOW_MS,
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
  enviarAvisoBloqueoCuenta: jest.fn(),
}));

const mockPool = jest.requireMock("@/lib/db").pool as { query: jest.Mock };
const mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;
const mockMailer = jest.requireMock("@/lib/mailer") as {
  enviarCodigoVerificacion: jest.Mock;
  enviarAvisoBloqueoCuenta: jest.Mock;
};

const mockDbRow = {
  id_usuario: testUserDueno.id_usuario,
  nombre: testUserDueno.nombre,
  correo: testUserDueno.correo,
  tipo_usuario: testUserDueno.tipo_usuario,
  contrasena_hash: "$2a$04$mocked",
  requiere_2fa: false,
  requiere_cambio_contrasena: false,
};

const mockDbDueno = { ...mockDbRow, tipo_usuario: "DUENO", requiere_2fa: true };

// El 2FA aplica a DUEÑO y EMPLEADO; el bodeguero queda exento.
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
    // `jest.clearAllMocks()` borra las llamadas pero NO las implementaciones:
    // un mockRejectedValue de un test anterior seguía activo y hacía que este
    // test recibiera un 502 en vez de su respuesta real.
    mockMailer.enviarCodigoVerificacion.mockReset();
    mockMailer.enviarAvisoBloqueoCuenta.mockReset();
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
    expect(isLoginRateLimited).toHaveBeenCalledWith("ip:203.0.113.50");
    // Además de la IP, se controla la cuenta: sin esto, un ataque que reparte
    // los intentos entre varias IP nunca llegaría al máximo por IP.
    expect(isLoginRateLimited).toHaveBeenCalledWith("acct:juan@tienda.com");
    expect(recordFailedLogin).toHaveBeenCalledWith("ip:203.0.113.50");
    expect(recordFailedLogin).toHaveBeenCalledWith(
      "acct:juan@tienda.com",
      ACCOUNT_LOCKOUT_MAX,
      ACCOUNT_LOCKOUT_WINDOW_MS
    );
  });

  it("records a failed login when the password is wrong", async () => {
    mockPool.query.mockResolvedValue({ rows: [mockDbRow], rowCount: 1 });
    mockBcrypt.compareSync.mockReturnValue(false);

    await POST(failedLoginRequest());
    expect(recordFailedLogin).toHaveBeenCalledTimes(2);
    expect(recordFailedLogin).toHaveBeenCalledWith("ip:203.0.113.10");
  });

  it("clears failed attempts after a successful login", async () => {
    mockPool.query.mockResolvedValue({ rows: [mockDbRow], rowCount: 1 });
    mockBcrypt.compareSync.mockReturnValue(false);

    await POST(failedLoginRequest());
    expect(recordFailedLogin).toHaveBeenCalledTimes(2);

    mockBcrypt.compareSync.mockReturnValue(true);
    const success = await POST(
      createMockRequest("/api/login", {
        method: "POST",
        body: { username: "juan@tienda.com", password: "correcta" },
        headers: { "x-forwarded-for": "203.0.113.10" },
      })
    );
    expect(success.status).toBe(200);
    // Se limpian las dos claves, no sólo la de IP: si el bloqueo por cuenta
    // quedara, el usuario no podría entrar ni con la contraseña correcta.
    expect(clearFailedLogins).toHaveBeenCalledWith("ip:203.0.113.10");
    expect(clearFailedLogins).toHaveBeenCalledWith("acct:juan@tienda.com");
  });

  it("el token de sesión no viaja en el cuerpo de la respuesta, sólo en la cookie", async () => {
    mockPool.query.mockResolvedValue({ rows: [mockDbRow], rowCount: 1 });
    mockBcrypt.compareSync.mockReturnValue(true);

    const res = await POST(
      createMockRequest("/api/login", {
        method: "POST",
        body: { username: "juan@tienda.com", password: "correcta" },
      })
    );
    const data = await res.json();

    // Devolver el token en el JSON lo haría legible desde JavaScript y
    // anularía la protección httpOnly de la cookie.
    expect(data.token).toBeUndefined();
    expect(res.headers.get("set-cookie")).toContain("auth_token=");
  });

  it("una cuenta bloqueada por intentos falla como credenciales incorrectas, sin revelar el bloqueo", async () => {
    mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });
    (isLoginRateLimited as jest.Mock).mockImplementation(
      async (clave: string) => clave === "acct:juan@tienda.com"
    );

    const res = await POST(failedLoginRequest());
    const data = await res.json();

    // Ni 429 ni un mensaje que confirme que la cuenta existe: para quien
    // está probando contraseñas, esto es indistinguible de "no existe".
    expect(res.status).toBe(401);
    expect(data.error).toBe("Credenciales incorrectas");
  });

  it("avisa al correo de la cuenta sólo cuando el bloqueo se activa", async () => {
    mockPool.query.mockResolvedValue({ rows: [mockDbRow], rowCount: 1 });
    mockBcrypt.compareSync.mockReturnValue(false);
    (recordFailedLogin as jest.Mock).mockResolvedValue(false);

    await POST(failedLoginRequest());
    expect(mockMailer.enviarAvisoBloqueoCuenta).not.toHaveBeenCalled();

    // El intento que efectivamente activa el bloqueo sí avisa.
    (recordFailedLogin as jest.Mock).mockImplementation(
      async (clave: string) => clave.startsWith("acct:")
    );
    await POST(failedLoginRequest());
    expect(mockMailer.enviarAvisoBloqueoCuenta).toHaveBeenCalledWith(
      mockDbRow.correo,
      mockDbRow.nombre,
      ACCOUNT_LOCKOUT_WINDOW_MS / 60000,
      "203.0.113.10"
    );
  });

  it("el fallo al enviar el aviso no convierte el 401 en un error 500", async () => {
    mockPool.query.mockResolvedValue({ rows: [mockDbRow], rowCount: 1 });
    mockBcrypt.compareSync.mockReturnValue(false);
    (recordFailedLogin as jest.Mock).mockImplementation(
      async (clave: string) => clave.startsWith("acct:")
    );
    mockMailer.enviarAvisoBloqueoCuenta.mockRejectedValue(new Error("smtp caído"));

    const res = await POST(failedLoginRequest());
    expect(res.status).toBe(401);
  });

  it("compara contra un hash señuelo cuando el correo no existe (evita enumerar por tiempo)", async () => {
    mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });
    mockBcrypt.compareSync.mockReturnValue(false);

    const res = await POST(failedLoginRequest());

    expect(res.status).toBe(401);
    // Si no se comparara, "correo inexistente" respondería en microsegundos y
    // "contraseña incorrecta" en ~80 ms (el costo de bcrypt): eso revelaría
    // qué correos tienen cuenta.
    expect(mockBcrypt.compareSync).toHaveBeenCalledTimes(1);
    expect(mockBcrypt.compareSync.mock.calls[0][1]).toBe(
      "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy"
    );
  });

  it("bloquea el login de cuentas que deben cambiar su contraseña", async () => {
    mockPool.query.mockResolvedValue({
      rows: [{ ...mockDbRow, requiere_cambio_contrasena: true }],
      rowCount: 1,
    });
    mockBcrypt.compareSync.mockReturnValue(true);

    const res = await POST(
      createMockRequest("/api/login", {
        method: "POST",
        body: { username: "juan@tienda.com", password: "correcta" },
      })
    );
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(res.headers.get("set-cookie")).toBeNull();
    expect(data.error).toContain("cambiar tu contraseña");
  });

  it("exige 2FA también al dueño (antes entraba directo)", async () => {
    mockPool.query.mockResolvedValue({ rows: [mockDbDueno], rowCount: 1 });
    mockBcrypt.compareSync.mockReturnValue(true);

    const res = await POST(
      createMockRequest("/api/login", {
        method: "POST",
        body: { username: "dueno@tienda.com", password: "correcta" },
      })
    );
    const data = await res.json();

    expect(data.requiere_verificacion).toBe(true);
    expect(mockMailer.enviarCodigoVerificacion).toHaveBeenCalled();
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("el bodeguero sigue entrando sin 2FA", async () => {
    mockPool.query.mockResolvedValue({
      rows: [{ ...mockDbRow, tipo_usuario: "BODEGUERO", requiere_2fa: true }],
      rowCount: 1,
    });
    mockBcrypt.compareSync.mockReturnValue(true);

    const res = await POST(
      createMockRequest("/api/login", {
        method: "POST",
        body: { username: "bodega@tienda.com", password: "correcta" },
      })
    );
    const data = await res.json();

    expect(data.requiere_verificacion).toBe(false);
    expect(mockMailer.enviarCodigoVerificacion).not.toHaveBeenCalled();
  });
});
