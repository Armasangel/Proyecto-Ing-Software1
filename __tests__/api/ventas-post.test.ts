import { POST } from "@/app/api/ventas/route";
import { createMockRequest, testUserEmpleado } from "@/__tests__/utils/api-test-utils";

jest.mock("@/lib/db", () => ({
  pool: { query: jest.fn(), connect: jest.fn() },
}));

const mockPool = jest.requireMock("@/lib/db").pool as { connect: jest.Mock };

function makeClient() {
  const client = { query: jest.fn(), release: jest.fn() };
  mockPool.connect.mockResolvedValue(client);
  return client;
}

// Encadena las respuestas de client.query en el orden en que las pide la
// ruta para una venta feliz de una sola línea: BEGIN, SELECT cliente,
// SELECT bodegas, SELECT producto, SELECT subtotal, SELECT total redondeado,
// INSERT venta, SELECT stock FOR UPDATE, INSERT detalle_venta,
// UPDATE bodega_producto, INSERT kardex, COMMIT.
function encadenarVentaFeliz(client: ReturnType<typeof makeClient>, tipoCliente: string) {
  client.query
    .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // BEGIN
    .mockResolvedValueOnce({ rows: [{ tipo_cliente: tipoCliente }], rowCount: 1 }) // SELECT cliente
    .mockResolvedValueOnce({ rows: [{ id_bodega: 1 }], rowCount: 1 }) // SELECT bodegas
    .mockResolvedValueOnce({ rows: [{ id_producto: 1, estado_producto: true }], rowCount: 1 }) // SELECT producto
    .mockResolvedValueOnce({ rows: [{ sub: 10 }] }) // subtotal
    .mockResolvedValueOnce({ rows: [{ t: 10 }] }) // total redondeado
    .mockResolvedValueOnce({ rows: [{ id_venta: 99 }] }) // INSERT venta
    .mockResolvedValueOnce({ rows: [{ cantidad_disponible: 100 }], rowCount: 1 }) // stock FOR UPDATE
    .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // INSERT detalle_venta
    .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // UPDATE bodega_producto
    .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // INSERT kardex
    .mockResolvedValueOnce({ rows: [], rowCount: 0 }); // COMMIT
}

const lineaValida = { id_producto: 1, id_bodega: 1, cantidad: 1, precio_unitario_venta: 10 };

function makeReq(body: Record<string, unknown>) {
  return createMockRequest("/api/ventas", {
    method: "POST",
    user: testUserEmpleado,
    body: {
      id_cliente: 1,
      estado_pago: "PAGADO",
      tipo_entrega: "EN_TIENDA",
      lineas: [lineaValida],
      ...body,
    },
  });
}

function tipoVentaEnviado(client: ReturnType<typeof makeClient>): string {
  const insertCall = client.query.mock.calls.find((c) => (c[0] as string).includes("INSERT INTO venta"));
  // params: [idCliente, id_empleado, estado_venta, tipo_venta, ...]
  return (insertCall?.[1] as unknown[])[3] as string;
}

describe("POST /api/ventas — detección automática de tipo_venta", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 403 for a non-staff user", async () => {
    const req = makeReq({});
    // testUserEmpleado ya es staff; probamos sin cookie de sesión.
    const reqSinSesion = createMockRequest("/api/ventas", { method: "POST", body: {} });
    const res = await POST(reqSinSesion);
    expect(res.status).toBe(403);
    void req;
  });

  it("uses the client's tipo_cliente when tipo_venta isn't sent at all", async () => {
    const client = makeClient();
    encadenarVentaFeliz(client, "MAYORISTA");
    const res = await POST(makeReq({}));
    expect(res.status).toBe(200);
    expect(tipoVentaEnviado(client)).toBe("MAYORISTA");
    const data = await res.json();
    expect(data.tipo_venta).toBe("MAYORISTA");
  });

  it("ignores a mismatched tipo_venta from the body when forzar_tipo_venta isn't set", async () => {
    const client = makeClient();
    encadenarVentaFeliz(client, "MAYORISTA");
    // El front manda MINORISTA "por error" o desactualizado, pero el cliente
    // real es MAYORISTA y no se está forzando nada — debe ganar el cliente.
    const res = await POST(makeReq({ tipo_venta: "MINORISTA" }));
    expect(res.status).toBe(200);
    expect(tipoVentaEnviado(client)).toBe("MAYORISTA");
  });

  it("respects an explicit override when forzar_tipo_venta is true", async () => {
    const client = makeClient();
    encadenarVentaFeliz(client, "MINORISTA");
    const res = await POST(makeReq({ tipo_venta: "MAYORISTA", forzar_tipo_venta: true }));
    expect(res.status).toBe(200);
    expect(tipoVentaEnviado(client)).toBe("MAYORISTA");
  });

  it("rejects forzar_tipo_venta=true without a valid tipo_venta", async () => {
    const res = await POST(makeReq({ forzar_tipo_venta: true }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/forzar el tipo de venta/);
    expect(mockPool.connect).not.toHaveBeenCalled();
  });

  it("falls back to MINORISTA when the client's stored tipo_cliente is somehow invalid", async () => {
    const client = makeClient();
    encadenarVentaFeliz(client, "ALGO_RARO");
    const res = await POST(makeReq({}));
    expect(res.status).toBe(200);
    expect(tipoVentaEnviado(client)).toBe("MINORISTA");
  });

  it("returns 400 when the client doesn't exist or is inactive", async () => {
    const client = makeClient();
    client.query
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // BEGIN
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }); // SELECT cliente (vacío)
    const res = await POST(makeReq({}));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/Cliente no encontrado/);
  });
});
