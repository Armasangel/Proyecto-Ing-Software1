import { GET, PATCH, POST } from "@/app/api/usuarios/route";
import { createMockRequest, testUserDueno, testUserEmpleado } from "@/__tests__/utils/api-test-utils";
import { checkRateLimit, getClientIp } from "@/lib/api-rate-limit";

jest.mock("@/lib/db", () => ({
  pool: { query: jest.fn(), connect: jest.fn() },
}));

jest.mock("@/lib/api-rate-limit", () => ({
  checkRateLimit: jest.fn(),
  getClientIp: jest.fn(() => "1.2.3.4"),
}));

const mockPool = jest.requireMock("@/lib/db").pool as { query: jest.Mock };
const mockCheckRateLimit = checkRateLimit as jest.MockedFunction<typeof checkRateLimit>;

const mockUsuarios = [
  { id_usuario: 1, nombre: "Juan Pérez", correo: "juan@tienda.com", telefono: "11111111", tipo_usuario: "DUENO", estado_usuario: true },
  { id_usuario: 2, nombre: "María López", correo: "maria@tienda.com", telefono: "22222222", tipo_usuario: "EMPLEADO", estado_usuario: true },
];

describe("GET /api/usuarios", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPool.query.mockResolvedValue({ rows: mockUsuarios });
    mockCheckRateLimit.mockResolvedValue({ limited: false, retryAfterSeconds: 0, restantes: 60 });
  });

  it("applies a per-IP rate limit keyed by method before anything else", async () => {
    const req = createMockRequest("/api/usuarios", { user: testUserDueno });
    await GET(req);
    expect(getClientIp).toHaveBeenCalledWith(req);
    expect(mockCheckRateLimit).toHaveBeenCalledWith(
      `usuarios:GET:${getClientIp(req)}`,
      60,
      60_000
    );
  });

  it("returns 429 when the rate limit is exceeded", async () => {
    mockCheckRateLimit.mockResolvedValue({ limited: true, retryAfterSeconds: 37, restantes: 0 });
    const req = createMockRequest("/api/usuarios", { user: testUserDueno });
    const res = await GET(req);
    expect(res.status).toBe(429);
    const data = await res.json();
    expect(data.error).toMatch(/Demasiadas solicitudes/);
    expect(data.error).toMatch(/37/);
  });

  it("returns 403 for empleado", async () => {
    const req = createMockRequest("/api/usuarios", { user: testUserEmpleado });
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it("returns 403 when unauthenticated", async () => {
    const req = createMockRequest("/api/usuarios");
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it("returns all usuarios for dueno", async () => {
    const req = createMockRequest("/api/usuarios", { user: testUserDueno });
    const res = await GET(req);
    const data = await res.json();
    expect(data.usuarios).toHaveLength(2);
  });

  it("filters by search query q", async () => {
    mockPool.query.mockResolvedValue({ rows: [mockUsuarios[0]] });
    const req = createMockRequest("/api/usuarios?q=juan", { user: testUserDueno });
    await GET(req);
    const query = mockPool.query.mock.calls.find((c: unknown[]) => (c[0] as string).includes("SELECT"));
    const sql = query?.[0] as string;
    expect(sql).toContain("LIKE");
  });

  it("filters by tipo", async () => {
    mockPool.query.mockResolvedValue({ rows: [mockUsuarios[1]] });
    const req = createMockRequest("/api/usuarios?tipo=EMPLEADO", { user: testUserDueno });
    await GET(req);
    const query = mockPool.query.mock.calls.find((c: unknown[]) => (c[0] as string).includes("SELECT"));
    const sql = query?.[0] as string;
    expect(sql).toContain("tipo_usuario");
  });

  describe("cupos de dueño", () => {
    /** Simula la base: la lista (posiblemente filtrada) y, aparte, el conteo real por tipo */
    function mockBase(lista: unknown[], totales: { tipo_usuario: string; total: number }[]) {
      mockPool.query.mockImplementation(async (sql: string) =>
        sql.includes("GROUP BY") ? { rows: totales } : { rows: lista }
      );
    }

    it("informa cuántos cupos de dueño quedan", async () => {
      mockBase(mockUsuarios, [
        { tipo_usuario: "DUENO", total: 1 },
        { tipo_usuario: "EMPLEADO", total: 4 },
      ]);
      const res = await GET(createMockRequest("/api/usuarios", { user: testUserDueno }));
      const data = await res.json();
      expect(data.cupos_dueno).toEqual({ usados: 1, maximo: 2, disponibles: 1 });
      expect(data.totales_por_tipo).toEqual({ DUENO: 1, EMPLEADO: 4, BODEGUERO: 0 });
    });

    it("con 2 dueños no quedan cupos (y nunca da negativos)", async () => {
      mockBase(mockUsuarios, [{ tipo_usuario: "DUENO", total: 3 }]);
      const res = await GET(createMockRequest("/api/usuarios", { user: testUserDueno }));
      const data = await res.json();
      expect(data.cupos_dueno).toEqual({ usados: 3, maximo: 2, disponibles: 0 });
    });

    it("cuenta a todos los dueños aunque la lista esté filtrada", async () => {
      // Filtro por EMPLEADO: la lista no trae ningún dueño, pero hay 2 en la base
      mockBase([mockUsuarios[1]], [
        { tipo_usuario: "DUENO", total: 2 },
        { tipo_usuario: "EMPLEADO", total: 1 },
      ]);
      const res = await GET(createMockRequest("/api/usuarios?tipo=EMPLEADO&q=maria", { user: testUserDueno }));
      const data = await res.json();

      expect(data.usuarios).toHaveLength(1);
      expect(data.cupos_dueno.disponibles).toBe(0);

      const consultaTotales = mockPool.query.mock.calls.find((c: unknown[]) => (c[0] as string).includes("GROUP BY"));
      expect(consultaTotales?.[0]).not.toContain("WHERE");
      expect(consultaTotales?.[1]).toBeUndefined();
    });

    it("sin dueños registrados informa todos los cupos libres", async () => {
      mockBase([], []);
      const res = await GET(createMockRequest("/api/usuarios", { user: testUserDueno }));
      const data = await res.json();
      expect(data.cupos_dueno).toEqual({ usados: 0, maximo: 2, disponibles: 2 });
    });
  });
});

describe("PATCH /api/usuarios", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue({ limited: false, retryAfterSeconds: 0, restantes: 20 });
  });

  it("returns 429 when the rate limit is exceeded", async () => {
    mockCheckRateLimit.mockResolvedValue({ limited: true, retryAfterSeconds: 10, restantes: 0 });
    const req = createMockRequest("/api/usuarios", {
      method: "PATCH",
      user: testUserDueno,
      body: { id_usuario: 3, tipo_usuario: "EMPLEADO" },
    });
    const res = await PATCH(req);
    expect(res.status).toBe(429);
    const data = await res.json();
    expect(data.error).toMatch(/10/);
  });

  it("updates a usuario", async () => {
    mockPool.query.mockResolvedValue({ rows: [{ ...mockUsuarios[1], estado_usuario: false }] });
    const req = createMockRequest("/api/usuarios", {
      method: "PATCH",
      user: testUserDueno,
      body: { id_usuario: 2, estado_usuario: false },
    });
    const res = await PATCH(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.usuario.estado_usuario).toBe(false);
  });

  it("rejects promoting a non-dueño directly to DUENO through this endpoint", async () => {
    // SELECT actual: el objetivo (id 2) es EMPLEADO hoy.
    mockPool.query.mockResolvedValueOnce({ rows: [{ tipo_usuario: "EMPLEADO", id_bodega: null }] });
    const req = createMockRequest("/api/usuarios", {
      method: "PATCH",
      user: testUserDueno,
      body: { id_usuario: 2, tipo_usuario: "DUENO" },
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/promover-dueno/);
  });

  it("allows a PATCH with tipo_usuario=DUENO as a no-op when the user is already dueño", async () => {
    // id 3: otro dueño distinto del que hace la solicitud (id 1), para no
    // pisar la validación de "no puedes editarte a vos mismo".
    mockPool.query
      .mockResolvedValueOnce({ rows: [{ tipo_usuario: "DUENO", id_bodega: null }] }) // SELECT actual
      .mockResolvedValueOnce({ rows: [{ id_usuario: 3, nombre: "Otro Dueño", tipo_usuario: "DUENO", estado_usuario: false }] }); // UPDATE
    const req = createMockRequest("/api/usuarios", {
      method: "PATCH",
      user: testUserDueno,
      body: { id_usuario: 3, tipo_usuario: "DUENO", estado_usuario: false },
    });
    const res = await PATCH(req);
    expect(res.status).toBe(200);
  });
});

describe("POST /api/usuarios", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue({ limited: false, retryAfterSeconds: 0, restantes: 10 });
  });

  it("returns 429 when the rate limit is exceeded", async () => {
    mockCheckRateLimit.mockResolvedValue({ limited: true, retryAfterSeconds: 25, restantes: 0 });
    const req = createMockRequest("/api/usuarios", {
      method: "POST",
      user: testUserDueno,
      body: { nombre: "Nuevo", correo: "nuevo@tienda.com", contrasena: "123456" },
    });
    const res = await POST(req);
    expect(res.status).toBe(429);
    const data = await res.json();
    expect(data.error).toMatch(/25/);
  });

  it("rejects creating a new user directly as DUENO", async () => {
    const req = createMockRequest("/api/usuarios", {
      method: "POST",
      user: testUserDueno,
      body: { nombre: "Nuevo", correo: "nuevo@tienda.com", contrasena: "123456", tipo_usuario: "DUENO" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/no se puede crear un usuario nuevo directamente como dueño/i);
    // No debería haber llegado a tocar la base de datos.
    expect(mockPool.query).not.toHaveBeenCalled();
  });

  it("creates a usuario", async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [] }) // no existe correo duplicado
      .mockResolvedValueOnce({ rows: [{ id_usuario: 3, nombre: "Nuevo", correo: "nuevo@tienda.com", tipo_usuario: "EMPLEADO", estado_usuario: true }] });
    const req = createMockRequest("/api/usuarios", {
      method: "POST",
      user: testUserDueno,
      body: { nombre: "Nuevo", correo: "nuevo@tienda.com", contrasena: "123456", tipo_usuario: "EMPLEADO" },
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.usuario.id_usuario).toBe(3);
  });
});