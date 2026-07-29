import { GET } from "@/app/api/ventas/route";
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
  total: 50.00,
  fecha_limite_pago: null,
  nombre_cliente: "Carlos Ruiz",
  correo_cliente: "carlos@email.com",
  nombre_colaborador: "María López",
  productos: [],
};

describe("GET /api/ventas", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 403 when unauthenticated", async () => {
    const req = createMockRequest("/api/ventas");
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it("returns ventas with pagination for dueno", async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [{ total: 1 }] })
      .mockResolvedValueOnce({ rows: [mockVenta] });
    const req = createMockRequest("/api/ventas", { user: testUserDueno });
    const res = await GET(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.ventas).toHaveLength(1);
    expect(data.pagination).toMatchObject({ total: 1, page: 1, limit: 50 });
  });

  it("returns ventas for empleado", async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [{ total: 1 }] })
      .mockResolvedValueOnce({ rows: [mockVenta] });
    const req = createMockRequest("/api/ventas", { user: testUserEmpleado });
    const res = await GET(req);
    expect(res.status).toBe(200);
  });

  it("respects page and limit query params", async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [{ total: 100 }] })
      .mockResolvedValueOnce({ rows: [] });
    const req = createMockRequest("/api/ventas?page=3&limit=20", { user: testUserDueno });
    const res = await GET(req);
    const data = await res.json();
    expect(data.pagination).toMatchObject({ page: 3, limit: 20 });
  });

  it("caps limit to 100", async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [{ total: 100 }] })
      .mockResolvedValueOnce({ rows: [] });
    const req = createMockRequest("/api/ventas?limit=999", { user: testUserDueno });
    const res = await GET(req);
    const data = await res.json();
    expect(data.pagination.limit).toBe(100);
  });
});
