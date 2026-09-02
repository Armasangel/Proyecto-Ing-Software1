import { GET, POST } from "@/app/api/deudas/route";
import { createMockRequest, testUserDueno, testUserEmpleado } from "@/__tests__/utils/api-test-utils";
import { recalcularBloqueoCliente, verificarLimiteAntesDeDeuda } from "@/lib/deuda-alertas";

jest.mock("@/lib/db", () => ({
  pool: { query: jest.fn(), connect: jest.fn() },
}));

jest.mock("@/lib/deuda-alertas", () => ({
  verificarLimiteAntesDeDeuda: jest.fn(),
  recalcularBloqueoCliente: jest.fn(),
}));

const mockPool = jest.requireMock("@/lib/db").pool as {
  query: jest.Mock;
  connect: jest.Mock;
};
const mockVerificar = verificarLimiteAntesDeDeuda as jest.MockedFunction<typeof verificarLimiteAntesDeDeuda>;

const deudaFila = {
  id_deuda: 1,
  nombre_deudor: "Pedro Díaz",
  monto_total: 100,
  estado_deuda: "PENDIENTE",
  total_pagado: 25,
  saldo_pendiente: 75,
  porcentaje_cubierto: 25,
  pagos: [],
};

describe("GET /api/deudas", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPool.query.mockResolvedValue({ rows: [deudaFila] });
  });

  it("returns 403 when unauthenticated", async () => {
    const req = createMockRequest("/api/deudas");
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it("allows staff and returns the debt with payment percentage fields", async () => {
    const req = createMockRequest("/api/deudas", { user: testUserEmpleado });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.deudas[0]).toEqual(
      expect.objectContaining({
        total_pagado: 25,
        saldo_pendiente: 75,
        porcentaje_cubierto: 25,
      })
    );
  });

  it("computes total_pagado, saldo_pendiente and porcentaje_cubierto in the SQL", async () => {
    const req = createMockRequest("/api/deudas", { user: testUserDueno });
    await GET(req);
    const sql = mockPool.query.mock.calls[0][0] as string;
    expect(sql).toContain("total_pagado");
    expect(sql).toContain("saldo_pendiente");
    expect(sql).toContain("porcentaje_cubierto");
    expect(sql).toContain("pago_deuda");
  });
});

describe("POST /api/deudas", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVerificar.mockResolvedValue({ permitido: true, motivo: null, deuda_pendiente_actual: 0, limite_deuda: null });
  });

  it("verifica el límite de deuda del cliente antes de crear la deuda", async () => {
    const client = {
      query: jest.fn().mockResolvedValue({ rows: [{ id_deuda: 2 }], rowCount: 1 }),
      release: jest.fn(),
    };
    mockPool.connect.mockResolvedValue(client);

    client.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // BEGIN
    client.query.mockResolvedValueOnce({ rows: [{ 1: 1 }], rowCount: 1 }); // cliente existe
    client.query.mockResolvedValueOnce({ rows: [{ id_producto: 1, precio_unitario: 25 }] }); // precios
    client.query.mockResolvedValueOnce({ rows: [{ id_deuda: 2 }] }); // INSERT deuda
    client.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // INSERT deuda_producto
    client.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // recalcular cliente
    client.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // COMMIT

    const req = createMockRequest("/api/deudas", {
      method: "POST",
      user: testUserDueno,
      body: {
        nombre_deudor: "Pedro Díaz",
        fecha_inicio: "2026-07-01",
        id_cliente: 1,
        productos: [{ id_producto: 1, cantidad: 4 }],
      },
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    expect(mockVerificar).toHaveBeenCalled();
  });
});