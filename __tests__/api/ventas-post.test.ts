import { POST } from "@/app/api/ventas/route";
import { createMockRequest, testUserEmpleado } from "@/__tests__/utils/api-test-utils";

jest.mock("@/lib/db", () => ({
  pool: { query: jest.fn(), connect: jest.fn() },
}));

// El cálculo de descuentos pega a la base con sus propias consultas. Aquí se
// mockea la carga para que las cadenas de mockResolvedValueOnce sigan haciendo
// match con las consultas que hace la ruta. Por defecto no hay descuentos.
jest.mock("@/lib/descuentos", () => ({
  ...jest.requireActual("@/lib/descuentos"),
  cargarDescuentosAplicables: jest.fn(),
}));

const mockCargarDescuentos = jest.requireMock("@/lib/descuentos").cargarDescuentosAplicables as jest.Mock;

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
function encadenarVentaFeliz(
  client: ReturnType<typeof makeClient>,
  tipoCliente: string,
  esConsumidorFinal = false
) {
  client.query
    .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // BEGIN
    .mockResolvedValueOnce({
      rows: [{ tipo_cliente: tipoCliente, es_consumidor_final: esConsumidorFinal }],
      rowCount: 1,
    }) // SELECT cliente
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
  beforeEach(() => {
    jest.clearAllMocks();
    mockCargarDescuentos.mockResolvedValue([]);
  });

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

describe("POST /api/ventas — Consumidor Final", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCargarDescuentos.mockResolvedValue([]);
  });

  it("rejects a credit sale for the Consumidor Final client", async () => {
    const client = makeClient();
    client.query
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // BEGIN
      .mockResolvedValueOnce({
        rows: [{ tipo_cliente: "MINORISTA", es_consumidor_final: true }],
        rowCount: 1,
      }) // SELECT cliente
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }); // ROLLBACK

    const res = await POST(
      makeReq({ condicion_pago: "CREDITO", credito: { plazo_dias: 30, numero_cuotas: 1 } })
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/Consumidor Final no puede comprar a crédito/);

    // No se registra nada: ni venta, ni factura, ni deuda.
    const inserto = client.query.mock.calls.some((c) =>
      (c[0] as string).includes("INSERT")
    );
    expect(inserto).toBe(false);
  });

  it("allows a cash sale for the Consumidor Final client", async () => {
    const client = makeClient();
    encadenarVentaFeliz(client, "MINORISTA", true);
    const res = await POST(makeReq({ condicion_pago: "CONTADO" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id_venta).toBe(99);
    expect(data.condicion_pago).toBe("CONTADO");
  });
});

describe("POST /api/ventas — aplicación de descuentos", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCargarDescuentos.mockResolvedValue([]);
  });

  // Igual que encadenarVentaFeliz pero con un subtotal controlado para poder
  // verificar el descuento por línea.
  function encadenarVenta(
    client: ReturnType<typeof makeClient>,
    opciones: { tipoCliente?: string; subtotalBruto?: number } = {}
  ) {
    const { tipoCliente = "MINORISTA", subtotalBruto = 100 } = opciones;
    client.query
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // BEGIN
      .mockResolvedValueOnce({ rows: [{ tipo_cliente: tipoCliente }], rowCount: 1 }) // SELECT cliente
      .mockResolvedValueOnce({ rows: [{ id_bodega: 1 }], rowCount: 1 }) // SELECT bodegas
      .mockResolvedValueOnce({ rows: [{ id_producto: 1, estado_producto: true }], rowCount: 1 }) // SELECT producto
      .mockResolvedValueOnce({ rows: [{ sub: subtotalBruto }] }) // subtotal bruto
      .mockResolvedValueOnce({ rows: [{ t: subtotalBruto * 0.9 }] }) // total redondeado (neto)
      .mockResolvedValueOnce({ rows: [{ id_venta: 99 }] }) // INSERT venta
      .mockResolvedValueOnce({ rows: [{ cantidad_disponible: 100 }], rowCount: 1 }) // stock FOR UPDATE
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // INSERT detalle_venta
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // UPDATE bodega_producto
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // INSERT kardex
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }); // COMMIT
  }

  const regla = {
    id_descuento: 7,
    nombre: "Mayoreo 10%",
    tipo: "CANTIDAD",
    tramos: [{ cantidad_desde: 1, porcentaje: 10 }],
  };

  it("applies the discount and stores the net subtotal per line", async () => {
    mockCargarDescuentos.mockResolvedValue([regla]);
    const client = makeClient();
    // La línea es cantidad 1 × precio 10 = subtotal bruto 100 (mock), 10% = 10.
    encadenarVenta(client, { subtotalBruto: 100 });
    const res = await POST(makeReq({}));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.descuento_total).toBe(10);
    expect(data.total).toBe(90);

    const detalle = client.query.mock.calls.find((c) =>
      (c[0] as string).includes("INSERT INTO detalle_venta")
    );
    const params = detalle?.[1] as unknown[];
    // [id_venta, id_producto, id_bodega, cantidad, precio, subtotal, %, monto, id_desc, nombre]
    expect(params[5]).toBe(90); // subtotal neto
    expect(params[6]).toBe(10); // descuento_porcentaje
    expect(params[7]).toBe(10); // descuento_monto
    expect(params[8]).toBe(7); // id_descuento
    expect(params[9]).toBe("Mayoreo 10%"); // descuento_nombre

    const venta = client.query.mock.calls.find((c) =>
      (c[0] as string).includes("INSERT INTO venta")
    );
    const vParams = venta?.[1] as unknown[];
    expect(vParams[6]).toBe(90); // total neto
    expect(vParams[10]).toBe(10); // descuento_total
  });

  it("passes the client's tipo_cliente to the discount loader", async () => {
    const client = makeClient();
    encadenarVenta(client, { tipoCliente: "MAYORISTA" });
    await POST(makeReq({}));
    expect(mockCargarDescuentos).toHaveBeenCalledTimes(1);
    expect(mockCargarDescuentos.mock.calls[0][1]).toBe(1); // id_cliente
    expect(mockCargarDescuentos.mock.calls[0][2]).toBe("MAYORISTA");
  });
});
