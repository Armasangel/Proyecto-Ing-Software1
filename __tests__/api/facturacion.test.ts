import { POST } from "@/app/api/facturacion/route";
import { createMockRequest, testUserDueno } from "@/__tests__/utils/api-test-utils";

jest.mock("@/lib/db", () => ({
  pool: { query: jest.fn(), connect: jest.fn() },
}));

const mockPool = jest.requireMock("@/lib/db").pool as { query: jest.Mock };

describe("POST /api/facturacion", () => {
  beforeEach(() => jest.clearAllMocks());

  it("genera el número de factura con nextval de Postgres, no con Date.now()", async () => {
    mockPool.query
      // SELECT total FROM venta
      .mockResolvedValueOnce({ rows: [{ total: 150.0 }] })
      // INSERT INTO factura ... RETURNING id_factura, numero_factura
      .mockResolvedValueOnce({ rows: [{ id_factura: 7, numero_factura: "FACT-000007" }] })
      // UPDATE venta SET estado_venta = 'CONFIRMADO'
      .mockResolvedValueOnce({ rows: [] });

    const req = createMockRequest("/api/facturacion", {
      method: "POST",
      user: testUserDueno,
      body: { id_venta: 1, nombre_cliente: "Cliente Prueba", nit_cliente: "1234567-8" },
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.numero_factura).toBe("FACT-000007");

    // La query de INSERT debe usar nextval('factura_numero_seq'), no Date.now().
    const insertCall = mockPool.query.mock.calls[1][0] as string;
    expect(insertCall).toMatch(/nextval\('factura_numero_seq'\)/);
  });

  it("devuelve 404 si la venta no existe", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    const req = createMockRequest("/api/facturacion", {
      method: "POST",
      user: testUserDueno,
      body: { id_venta: 999 },
    });

    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it("devuelve 400 si falta id_venta", async () => {
    const req = createMockRequest("/api/facturacion", {
      method: "POST",
      user: testUserDueno,
      body: {},
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});