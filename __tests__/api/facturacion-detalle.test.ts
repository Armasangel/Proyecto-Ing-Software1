import { GET } from "@/app/api/facturacion/[id]/route";
import {
  createMockRequest,
  testUserDueno,
  testUserEmpleado,
  mockQueryResult,
  mockQueryEmpty,
} from "@/__tests__/utils/api-test-utils";

jest.mock("@/lib/db", () => ({
  pool: { query: jest.fn(), connect: jest.fn() },
}));

const mockPool = jest.requireMock("@/lib/db").pool as { query: jest.Mock };

function makeReq(id: string, user: "dueno" | "empleado" | "none" = "dueno") {
  const options: { user?: typeof testUserDueno } = {};
  if (user === "dueno") options.user = testUserDueno;
  if (user === "empleado") options.user = testUserEmpleado;
  return createMockRequest(`/api/facturacion/${id}`, options);
}

const facturaCompleta = {
  id_venta: 5,
  fecha_venta: "2026-08-10T10:00:00.000Z",
  total: 250.5,
  estado_venta: "CONFIRMADO",
  nombre: "Cliente Prueba",
  correo: "cliente@test.com",
  id_factura: 7,
  numero_factura: "FACT-000007",
  nombre_cliente: "Cliente Prueba",
  nit_cliente: "1234567-8",
  total_factura: 250.5,
  productos: [
    {
      id_detalle: 1,
      codigo_producto: "P-01",
      nombre_producto: "Arroz 5lb",
      cantidad: 2,
      precio_unitario: 25.25,
      subtotal: 50.5,
    },
  ],
};

describe("GET /api/facturacion/:id", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 403 when unauthenticated", async () => {
    const req = makeReq("5", "none");
    const res = await GET(req, { params: { id: "5" } });
    expect(res.status).toBe(403);
    expect(mockPool.query).not.toHaveBeenCalled();
  });

  it("rejects a non-numeric id", async () => {
    const req = makeReq("abc");
    const res = await GET(req, { params: { id: "abc" } });
    expect(res.status).toBe(400);
  });

  it("returns 404 when the venta does not exist", async () => {
    mockPool.query.mockResolvedValueOnce(mockQueryEmpty());
    const req = makeReq("999");
    const res = await GET(req, { params: { id: "999" } });
    expect(res.status).toBe(404);
  });

  it("returns the invoice with its product lines for a dueño", async () => {
    mockPool.query.mockResolvedValueOnce(mockQueryResult([facturaCompleta]));
    const req = makeReq("5", "dueno");
    const res = await GET(req, { params: { id: "5" } });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.factura.numero_factura).toBe("FACT-000007");
    expect(data.factura.productos).toHaveLength(1);
    expect(data.factura.productos[0].nombre_producto).toBe("Arroz 5lb");
  });

  it("allows a colaborador (staff) to view the invoice too", async () => {
    mockPool.query.mockResolvedValueOnce(mockQueryResult([facturaCompleta]));
    const req = makeReq("5", "empleado");
    const res = await GET(req, { params: { id: "5" } });
    expect(res.status).toBe(200);
  });

  it("returns an empty product list when the sale has no line items", async () => {
    mockPool.query.mockResolvedValueOnce(
      mockQueryResult([{ ...facturaCompleta, productos: [] }])
    );
    const req = makeReq("5");
    const res = await GET(req, { params: { id: "5" } });
    const data = await res.json();
    expect(data.factura.productos).toEqual([]);
  });

  it("returns 500 if the query fails", async () => {
    mockPool.query.mockRejectedValueOnce(new Error("boom"));
    const req = makeReq("5");
    const res = await GET(req, { params: { id: "5" } });
    expect(res.status).toBe(500);
  });
});
