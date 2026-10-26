import { GET, POST } from "@/app/api/productos/route";
import { createMockRequest, testUserDueno, testUserEmpleado } from "@/__tests__/utils/api-test-utils";

jest.mock("@/lib/db", () => ({
  pool: {
    query: jest.fn(),
    connect: jest.fn(),
  },
}));

const mockPool = jest.requireMock("@/lib/db").pool as {
  query: jest.Mock;
  connect: jest.Mock;
};

const mockClient = {
  query: jest.fn(),
  release: jest.fn(),
};


const mockProductos = [
  {
    id_producto: 1,
    codigo_producto: "PROD-001",
    nombre_producto: "Leche Entera",
    precio_unitario: 25.00,
    precio_mayoreo: 22.00,
    unidad_medida: "Litro",
    estado_producto: true,
    nombre_categoria: "Lácteos",
    nombre_marca: "Marca A",
  },
];

describe("GET /api/productos", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 403 when unauthenticated", async () => {
    const req = createMockRequest("/api/productos");
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it("returns productos for dueno", async () => {
    mockPool.query.mockResolvedValue({ rows: mockProductos });
    const req = createMockRequest("/api/productos", { user: testUserDueno });
    const res = await GET(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.productos).toHaveLength(1);
    expect(data.productos[0].codigo_producto).toBe("PROD-001");
  });

  it("returns productos for empleado", async () => {
    mockPool.query.mockResolvedValue({ rows: mockProductos });
    const req = createMockRequest("/api/productos", { user: testUserEmpleado });
    const res = await GET(req);
    expect(res.status).toBe(200);
  });

  it("queries with JOINs and orders by name", async () => {
    mockPool.query.mockResolvedValue({ rows: mockProductos });
    const req = createMockRequest("/api/productos", { user: testUserDueno });
    await GET(req);
    const sql = mockPool.query.mock.calls[0][0] as string;
    expect(sql).toContain("JOIN categoria");
    expect(sql).toContain("JOIN marca");
    expect(sql).toContain("ORDER BY p.nombre_producto");
  });
});

describe("POST /api/productos", () => {
  beforeEach(() => {
  jest.clearAllMocks();
  mockClient.query.mockReset();
  mockClient.release.mockReset();
});

  it("returns 403 when unauthenticated", async () => {
    const req = createMockRequest("/api/productos", {
      method: "POST",
      body: { codigo_producto: "NEW", nombre_producto: "Test", unidad_medida: "Unidad", id_categoria: 1, id_marca: 1 },
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("returns 400 when required fields are missing", async () => {
    const req = createMockRequest("/api/productos", {
      method: "POST",
      user: testUserDueno,
      body: { nombre_producto: "Test" },
    });
    const res = await POST(req);
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toBe("Faltan campos obligatorios");
  });

  it.each(["litro", "ml", "GALÓN"])("requires bottles instead of volume unit %s", async (unidad_medida) => {
    const res = await POST(createMockRequest("/api/productos", {
      method: "POST", user: testUserDueno,
      body: { codigo_producto: "ACE-800", nombre_producto: "Aceite 800 ml", unidad_medida, id_categoria: 1, id_marca: 1 },
    }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("botella");
    expect(mockPool.connect).not.toHaveBeenCalled();
  });

  it.each([
    { id_categoria_2: null, id_categoria_3: null },
    { id_categoria_2: 2, id_categoria_3: 3 },
    { id_categoria_2: null, id_categoria_3: 3 },
  ])("creates a product with optional categories", async (extras) => {
    mockPool.connect.mockResolvedValue(mockClient);
    mockClient.query.mockResolvedValue({ rows: [{ id_producto: 99 }] });
    const res = await POST(createMockRequest("/api/productos", {
      method: "POST", user: testUserDueno,
      body: { codigo_producto: "NEW", nombre_producto: "Test", unidad_medida: "unidad", id_categoria: 1, id_marca: 1, ...extras },
    }));
    expect(res.status).toBe(201);
    const insert = mockClient.query.mock.calls.find(([sql]) => sql.includes("INSERT INTO producto ("));
    expect(insert[1].slice(11)).toEqual([extras.id_categoria_2, extras.id_categoria_3]);
  });

  it("rejects repeating the primary category in an optional slot", async () => {
    const res = await POST(createMockRequest("/api/productos", {
      method: "POST", user: testUserDueno,
      body: { codigo_producto: "NEW", nombre_producto: "Test", unidad_medida: "unidad", id_categoria: 1, id_marca: 1, id_categoria_2: 1 },
    }));
    expect(res.status).toBe(400);
    expect(mockPool.connect).not.toHaveBeenCalled();
  });

it("returns 201 on success", async () => {
  mockPool.connect.mockResolvedValue(mockClient);

  mockClient.query
    .mockResolvedValueOnce(undefined) // BEGIN
    .mockResolvedValueOnce({ rows: [{ id_producto: 99 }] }) // INSERT
    .mockResolvedValueOnce(undefined); // COMMIT

  const req = createMockRequest("/api/productos", {
    method: "POST",
    user: testUserDueno,
    body: {
      codigo_producto: "NEW",
      nombre_producto: "Test",
      unidad_medida: "Unidad",
      id_categoria: 1,
      id_marca: 1,
    },
  });

  const res = await POST(req);
  const data = await res.json();

  expect(res.status).toBe(201);
  expect(data.id_producto).toBe(99);
  expect(mockClient.release).toHaveBeenCalled();
});



it("returns 409 on duplicate code", async () => {
  const err = new Error("duplicate key") as any;
  err.code = "23505";

  mockPool.connect.mockResolvedValue(mockClient);

  mockClient.query
    .mockResolvedValueOnce(undefined) // BEGIN
    .mockRejectedValueOnce(err)       // INSERT
    .mockResolvedValueOnce(undefined); // ROLLBACK

  const req = createMockRequest("/api/productos", {
    method: "POST",
    user: testUserDueno,
    body: {
      codigo_producto: "EXISTS",
      nombre_producto: "Test",
      unidad_medida: "Unidad",
      id_categoria: 1,
      id_marca: 1,
    },
  });

  const res = await POST(req);
  const data = await res.json();

  expect(res.status).toBe(409);
  expect(data.error).toBe("El código de producto ya existe");
  expect(mockClient.release).toHaveBeenCalled();
});
});
