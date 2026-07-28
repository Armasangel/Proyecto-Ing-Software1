import { GET } from "@/app/api/categorias/route";
import { createMockRequest, testUserDueno, testUserEmpleado } from "@/__tests__/utils/api-test-utils";

jest.mock("@/lib/db", () => ({
  pool: { query: jest.fn(), connect: jest.fn() },
}));

const mockPool = jest.requireMock("@/lib/db").pool as { query: jest.Mock };

const mockCategorias = [
  { id_categoria: 1, nombre_categoria: "Bebidas" },
  { id_categoria: 2, nombre_categoria: "Lácteos" },
];

describe("GET /api/categorias", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPool.query.mockResolvedValue({ rows: mockCategorias });
  });

  it("returns 403 when unauthenticated", async () => {
    const req = createMockRequest("/api/categorias");
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it("returns categorias for dueno", async () => {
    const req = createMockRequest("/api/categorias", { user: testUserDueno });
    const res = await GET(req);
    const data = await res.json();
    expect(data.categorias).toHaveLength(2);
    expect(data.categorias[0].nombre_categoria).toBe("Bebidas");
  });

  it("returns categorias for empleado", async () => {
    const req = createMockRequest("/api/categorias", { user: testUserEmpleado });
    const res = await GET(req);
    expect(res.status).toBe(200);
  });

  it("queries ordered by nombre_categoria", async () => {
    const req = createMockRequest("/api/categorias", { user: testUserDueno });
    await GET(req);
    const sql = mockPool.query.mock.calls[0][0] as string;
    expect(sql).toContain("ORDER BY nombre_categoria");
  });
});
