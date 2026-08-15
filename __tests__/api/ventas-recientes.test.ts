import { GET } from "@/app/api/ventas/recientes/route";
import { createMockRequest, testUserDueno, testUserEmpleado } from "@/__tests__/utils/api-test-utils";

jest.mock("@/lib/db", () => ({
  pool: { query: jest.fn(), connect: jest.fn() },
}));

const mockPool = jest.requireMock("@/lib/db").pool as { query: jest.Mock };

describe("GET /api/ventas/recientes", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 403 for empleado (solo el dueño puede pedir esto)", async () => {
    const req = createMockRequest("/api/ventas/recientes", { user: testUserEmpleado });
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it("returns 403 when unauthenticated", async () => {
    const req = createMockRequest("/api/ventas/recientes");
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it("without 'desde', only returns the current max id and no ventas", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [{ max_id: 42 }] });
    const req = createMockRequest("/api/ventas/recientes", { user: testUserDueno });
    const res = await GET(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.ventas).toEqual([]);
    expect(data.ultimo_id).toBe(42);
  });

  it("returns ventas newer than 'desde'", async () => {
    mockPool.query.mockResolvedValueOnce({
      rows: [
        { id_venta: 43, total: 25.5, fecha_venta: "2026-08-10T10:00:00.000Z", nombre_empleado: "María López" },
        { id_venta: 44, total: 12.0, fecha_venta: "2026-08-10T10:05:00.000Z", nombre_empleado: "Juan Pérez" },
      ],
    });
    const req = createMockRequest("/api/ventas/recientes?desde=42", { user: testUserDueno });
    const res = await GET(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.ventas).toHaveLength(2);
    expect(data.ultimo_id).toBe(44);
  });

  it("when there are no new ventas, keeps 'ultimo_id' at 'desde'", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });
    const req = createMockRequest("/api/ventas/recientes?desde=42", { user: testUserDueno });
    const res = await GET(req);
    const data = await res.json();
    expect(data.ventas).toEqual([]);
    expect(data.ultimo_id).toBe(42);
  });
});