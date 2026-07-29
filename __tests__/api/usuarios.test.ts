import { GET } from "@/app/api/usuarios/route";
import { createMockRequest, testUserDueno, testUserEmpleado } from "@/__tests__/utils/api-test-utils";

jest.mock("@/lib/db", () => ({
  pool: { query: jest.fn(), connect: jest.fn() },
}));

const mockPool = jest.requireMock("@/lib/db").pool as { query: jest.Mock };

const mockUsuarios = [
  { id_usuario: 1, nombre: "Juan Pérez", correo: "juan@tienda.com", telefono: "11111111", tipo_usuario: "DUENO", estado_usuario: true },
  { id_usuario: 2, nombre: "María López", correo: "maria@tienda.com", telefono: "22222222", tipo_usuario: "EMPLEADO", estado_usuario: true },
];

describe("GET /api/usuarios", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPool.query.mockResolvedValue({ rows: mockUsuarios });
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
    const sql = mockPool.query.mock.calls[0][0] as string;
    expect(sql).toContain("LIKE");
  });

  it("filters by tipo", async () => {
    mockPool.query.mockResolvedValue({ rows: [mockUsuarios[1]] });
    const req = createMockRequest("/api/usuarios?tipo=EMPLEADO", { user: testUserDueno });
    await GET(req);
    const sql = mockPool.query.mock.calls[0][0] as string;
    expect(sql).toContain("tipo_usuario");
  });
});
