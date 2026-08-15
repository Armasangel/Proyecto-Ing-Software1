import { GET } from "@/app/api/stats/route";
import { createMockRequest, testUserDueno, testUserEmpleado } from "@/__tests__/utils/api-test-utils";

jest.mock("@/lib/db", () => ({
  pool: { query: jest.fn(), connect: jest.fn() },
}));

const mockPool = jest.requireMock("@/lib/db").pool as { query: jest.Mock };

describe("GET /api/stats", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 403 when unauthenticated", async () => {
    const req = createMockRequest("/api/stats");
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it("returns counts for authenticated staff", async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [{ n: 5 }] })
      .mockResolvedValueOnce({ rows: [{ n: 10 }] })
      .mockResolvedValueOnce({ rows: [{ n: 2 }] })
      .mockResolvedValueOnce({ rows: [{ n: 3 }] });
    const req = createMockRequest("/api/stats", { user: testUserDueno });
    const res = await GET(req);
    const data = await res.json();
    expect(data.stats).toEqual({
      productos: 5,
      ventas: 10,
      pendientes: 2,
      proveedores: 3,
    });
  });

  it("returns a generic 500 on DB error", async () => {
    mockPool.query.mockRejectedValue(new Error("db down"));
    const req = createMockRequest("/api/stats", { user: testUserDueno });
    const res = await GET(req);
    const data = await res.json();
    expect(res.status).toBe(500);
    expect(data.error).toBe("Error interno del servidor");
    expect(data.stats).toBeUndefined();
  });
});
