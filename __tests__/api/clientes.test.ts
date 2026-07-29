import { GET } from "@/app/api/clientes/route";
import { createMockRequest, testUserDueno, testUserEmpleado, mockQueryResult } from "@/__tests__/utils/api-test-utils";

jest.mock("@/lib/db", () => ({
  pool: { query: jest.fn(), connect: jest.fn() },
}));

const mockPool = jest.requireMock("@/lib/db").pool as { query: jest.Mock };

const mockClientes = [
  { id_cliente: 1, nombre: "Carlos Ruiz", correo: "carlos@email.com", tipo_cliente: "MINORISTA" },
  { id_cliente: 2, nombre: "Ana García", correo: "ana@email.com", tipo_cliente: "MAYORISTA" },
];

describe("GET /api/clientes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPool.query.mockResolvedValue({ rows: mockClientes, rowCount: 2 });
  });

  it("returns 403 when unauthenticated", async () => {
    const req = createMockRequest("/api/clientes");
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it("returns clientes for authenticated dueno", async () => {
    const req = createMockRequest("/api/clientes", { user: testUserDueno });
    const res = await GET(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.clientes).toHaveLength(2);
    expect(data.clientes[0].nombre).toBe("Carlos Ruiz");
  });

  it("returns clientes for authenticated empleado", async () => {
    const req = createMockRequest("/api/clientes", { user: testUserEmpleado });
    const res = await GET(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.clientes).toHaveLength(2);
  });

  it("queries only active clients ordered by name", async () => {
    const req = createMockRequest("/api/clientes", { user: testUserDueno });
    await GET(req);
    expect(mockPool.query).toHaveBeenCalledTimes(1);
    const sql = mockPool.query.mock.calls[0][0] as string;
    expect(sql).toContain("estado_cliente = TRUE");
    expect(sql).toContain("ORDER BY nombre");
    expect(sql).toContain("cliente");
  });
});
