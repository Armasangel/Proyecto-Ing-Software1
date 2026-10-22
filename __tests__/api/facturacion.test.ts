import { POST } from "@/app/api/facturacion/route";
import { createMockRequest, testUserDueno } from "@/__tests__/utils/api-test-utils";

jest.mock("@/lib/db", () => ({
  pool: { query: jest.fn(), connect: jest.fn() },
}));

const mockPool = jest.requireMock("@/lib/db").pool as { query: jest.Mock };

const clienteFactura = {
  total: 150.0,
  nombre: "Cliente Prueba",
  nit_cliente: "1234567-8",
  direccion: "Zona 1, Guatemala",
};

function bodyValido(overrides: Record<string, unknown> = {}) {
  return createMockRequest("/api/facturacion", {
    method: "POST",
    user: testUserDueno,
    body: { id_venta: 1, ...overrides },
  });
}

describe("POST /api/facturacion", () => {
  beforeEach(() => jest.clearAllMocks());

  it("emite una factura normal con el correlativo de Postgres y los datos del cliente", async () => {
    mockPool.query
      // SELECT venta + cliente
      .mockResolvedValueOnce({ rows: [clienteFactura] })
      // INSERT INTO factura ... RETURNING id_factura, numero_factura
      .mockResolvedValueOnce({ rows: [{ id_factura: 7, numero_factura: "FACT-000007" }] })
      // UPDATE venta SET estado_venta = 'CONFIRMADO'
      .mockResolvedValueOnce({ rows: [] });

    const res = await POST(bodyValido());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.numero_factura).toBe("FACT-000007");
    expect(data.tipo_documento).toBe("FACTURA");

    const insertCall = mockPool.query.mock.calls[1];
    expect(insertCall[0]).toMatch(/nextval\('factura_numero_seq'\)/);
    expect(insertCall[1]).toEqual([
      1,
      "FACT",
      "FACTURA",
      "Cliente Prueba",
      "1234567-8",
      "Zona 1, Guatemala",
      150,
    ]);
  });

  it("emite una factura cambiaria usando NIT y dirección ampliados del cliente", async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [clienteFactura] })
      .mockResolvedValueOnce({ rows: [{ id_factura: 8, numero_factura: "FCAM-000008" }] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await POST(bodyValido({ tipo_documento: "FACTURA_CAMBIARIA" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.tipo_documento).toBe("FACTURA_CAMBIARIA");
    expect(data.nit_cliente).toBe("1234567-8");
    expect(data.direccion_cliente).toBe("Zona 1, Guatemala");

    const insertCall = mockPool.query.mock.calls[1];
    expect(insertCall[1]).toEqual([
      1,
      "FCAM",
      "FACTURA_CAMBIARIA",
      "Cliente Prueba",
      "1234567-8",
      "Zona 1, Guatemala",
      150,
    ]);
  });

  it("rechaza una factura cambiaria si el cliente no tiene NIT", async () => {
    mockPool.query.mockResolvedValueOnce({
      rows: [{ ...clienteFactura, nit_cliente: "CF" }],
    });

    const res = await POST(bodyValido({ tipo_documento: "FACTURA_CAMBIARIA" }));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toMatch(/NIT registrado/);
    expect(mockPool.query).toHaveBeenCalledTimes(1);
  });

  it("rechaza una factura cambiaria si el cliente no tiene dirección", async () => {
    mockPool.query.mockResolvedValueOnce({
      rows: [{ ...clienteFactura, direccion: null }],
    });

    const res = await POST(bodyValido({ tipo_documento: "FACTURA_CAMBIARIA" }));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toMatch(/dirección registrada/);
    expect(mockPool.query).toHaveBeenCalledTimes(1);
  });

  it("rechaza un tipo de documento desconocido", async () => {
    const res = await POST(bodyValido({ tipo_documento: "OTRO" }));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toMatch(/tipo_documento/);
    expect(mockPool.query).not.toHaveBeenCalled();
  });

  it("devuelve 404 si la venta no existe", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    const res = await POST(bodyValido({ id_venta: 999 }));
    expect(res.status).toBe(404);
  });

  it("devuelve 400 si falta id_venta", async () => {
    const res = await POST(bodyValido({ id_venta: undefined }));
    expect(res.status).toBe(400);
  });
});
