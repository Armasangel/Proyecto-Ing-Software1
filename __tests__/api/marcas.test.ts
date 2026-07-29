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
});
