import { GET } from "@/app/api/historial-ventas/route";
import { createMockRequest, testUserDueno, testUserEmpleado } from "@/__tests__/utils/api-test-utils";

jest.mock("@/lib/db", () => ({
  pool: { query: jest.fn(), connect: jest.fn() },
}));

const mockPool = jest.requireMock("@/lib/db").pool as { query: jest.Mock };

const mockVenta = {
  id_venta: 1,
  id_cliente: 1,
  id_empleado: 2,
  fecha_venta: "2026-07-28T10:00:00.000Z",
  estado_venta: "CONFIRMADO",
  tipo_venta: "MINORISTA",
  tipo_entrega: "EN_TIENDA",
  direccion_entrega: null,
  enlinea: false,
  total: 50.00,
  fecha_limite_pago: null,
  nombre_cliente: "Carlos Ruiz",
  correo_cliente: "carlos@email.com",
  nombre_colaborador: "María López",
  productos: [],
};

describe("GET /api/historial-ventas", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 403 when unauthenticated", async () => {
    const req = createMockRequest("/api/historial-ventas");
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it("returns 403 for empleado", async () => {
    const req = createMockRequest("/api/historial-ventas", { user: testUserEmpleado });
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it("returns ventas with pagination for dueno", async () => {
    mockPool.query.mockResolvedValue({ rows: [mockVenta] });
    const req = createMockRequest("/api/historial-ventas", { user: testUserDueno });
    const res = await GET(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.ventas).toHaveLength(1);
    expect(data.pagination).toMatchObject({ limit: 50, offset: 0, hasMore: false });
  });

  it("returns validation error for invalid periodo", async () => {
    const req = createMockRequest("/api/historial-ventas?periodo=decada", { user: testUserDueno });
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("includes totales when meta_totales is requested", async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [{ min_total: 10, max_total: 500 }] })
      .mockResolvedValueOnce({ rows: [mockVenta] });
    const req = createMockRequest("/api/historial-ventas?meta_totales=true", { user: testUserDueno });
    const res = await GET(req);
    const data = await res.json();
    expect(data.totales).toBeDefined();
    expect(data.totales.min_total).toBe(10);
    expect(data.totales.max_total).toBe(500);
  });

  it("filters by periodo", async () => {
    mockPool.query.mockResolvedValue({ rows: [] });
    const req = createMockRequest("/api/historial-ventas?periodo=month", { user: testUserDueno });
    await GET(req);
    const sql = mockPool.query.mock.calls[0][0] as string;
    expect(sql).toContain("WHERE");
  });
});
