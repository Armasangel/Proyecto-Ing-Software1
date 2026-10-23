import { GET } from "@/app/api/marcas/route";
import { createMockRequest, testUserDueno, testUserEmpleado } from "@/__tests__/utils/api-test-utils";

jest.mock("@/lib/db", () => ({
  pool: { query: jest.fn(), connect: jest.fn() },
}));

const mockPool = jest.requireMock("@/lib/db").pool as { query: jest.Mock };

const mockMarcas = [
  { id_marca: 1, nombre_marca: "Marca A" },
  { id_marca: 2, nombre_marca: "Marca B" },
];

describe("GET /api/marcas", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPool.query.mockResolvedValue({ rows: mockMarcas });
  });

  it("returns 403 when unauthenticated", async () => {
    const req = createMockRequest("/api/marcas");
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it("returns marcas for dueno", async () => {
    const req = createMockRequest("/api/marcas", { user: testUserDueno });
    const res = await GET(req);
    const data = await res.json();
    expect(data.marcas).toHaveLength(2);
  });

  it("returns marcas for empleado", async () => {
    const req = createMockRequest("/api/marcas", { user: testUserEmpleado });
    const res = await GET(req);
    expect(res.status).toBe(200);
  });

  it("includes brands without products and ranks usage by the number of assigned products", async () => {
    mockPool.query.mockResolvedValue({ rows: [
      { id_marca: 2, nombre_marca: "Marca B", usos: 10 },
      { id_marca: 1, nombre_marca: "Marca A", usos: 0 },
    ] });
    const res = await GET(createMockRequest("/api/marcas", { user: testUserDueno }));
    const data = await res.json();
    expect(data.marcas.map((m: { usos: number }) => m.usos)).toEqual([10, 0]);
    const sql = mockPool.query.mock.calls[0][0];
    expect(sql).toContain("LEFT JOIN producto p ON p.id_marca = m.id_marca");
    expect(sql).toContain("COUNT(p.id_producto)::int AS usos");
    expect(sql).toContain("ORDER BY usos DESC, m.nombre_marca");
  });
});
