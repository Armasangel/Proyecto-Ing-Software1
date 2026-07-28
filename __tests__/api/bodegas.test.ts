import { GET, POST } from "@/app/api/bodegas/route";
import { createMockRequest, testUserDueno, testUserEmpleado } from "@/__tests__/utils/api-test-utils";

jest.mock("@/lib/db", () => ({
  pool: { query: jest.fn(), connect: jest.fn() },
}));

const mockPool = jest.requireMock("@/lib/db").pool as { query: jest.Mock };

const mockBodegas = [
  { id_bodega: 1, nombre_bodega: "Bodega Central", ubicacion: "Zona 1", total_productos: 2, stock_total: 150 },
];

describe("GET /api/bodegas", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPool.query.mockResolvedValue({ rows: mockBodegas });
  });

  it("returns 403 when unauthenticated", async () => {
    const req = createMockRequest("/api/bodegas");
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it("returns bodegas for staff", async () => {
    const req = createMockRequest("/api/bodegas", { user: testUserDueno });
    const res = await GET(req);
    const data = await res.json();
    expect(data.bodegas).toHaveLength(1);
    expect(data.bodegas[0].nombre_bodega).toBe("Bodega Central");
  });

  it("allows empleado access", async () => {
    const req = createMockRequest("/api/bodegas", { user: testUserEmpleado });
    const res = await GET(req);
    expect(res.status).toBe(200);
  });
});

describe("POST /api/bodegas", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 403 for empleado", async () => {
    const req = createMockRequest("/api/bodegas", {
      method: "POST",
      user: testUserEmpleado,
      body: { nombre_bodega: "Nueva" },
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("returns 400 when name is missing", async () => {
    const req = createMockRequest("/api/bodegas", {
      method: "POST",
      user: testUserDueno,
      body: {},
    });
    const res = await POST(req);
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toBe("El nombre de la bodega es obligatorio");
  });

  it("returns 201 on successful creation", async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [{ id_bodega: 3, nombre_bodega: "Nueva Bodega", ubicacion: null }] });
    const req = createMockRequest("/api/bodegas", {
      method: "POST",
      user: testUserDueno,
      body: { nombre_bodega: "Nueva Bodega" },
    });
    const res = await POST(req);
    const data = await res.json();
    expect(res.status).toBe(201);
    expect(data.bodega.nombre_bodega).toBe("Nueva Bodega");
  });

  it("returns 409 when name already exists", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [{ id_bodega: 1 }], rowCount: 1 });
    const req = createMockRequest("/api/bodegas", {
      method: "POST",
      user: testUserDueno,
      body: { nombre_bodega: "Bodega Central" },
    });
    const res = await POST(req);
    const data = await res.json();
    expect(res.status).toBe(409);
    expect(data.error).toBe("Ya existe una bodega con ese nombre");
  });
});
