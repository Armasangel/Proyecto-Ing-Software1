import { POST } from "@/app/api/deudas/[id]/pagos/route";
import { createMockRequest, testUserDueno, testUserEmpleado } from "@/__tests__/utils/api-test-utils";
import { recalcularBloqueoCliente } from "@/lib/deuda-alertas";

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
const mockRecalcular = recalcularBloqueoCliente as jest.MockedFunction<typeof recalcularBloqueoCliente>;

function makeClient() {
  const client = {
    query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    release: jest.fn(),
  };
  mockPool.connect.mockResolvedValue(client);
  return client;
}

function makeReq(id: string, body: unknown) {
  return createMockRequest(`/api/deudas/${id}/pagos`, {
    method: "POST",
    user: testUserDueno,
    body,
  });
}

const deudaPendiente = {
  id_deuda: 1,
  monto_total: 100,
  estado_deuda: "PENDIENTE",
  id_cliente: 7,
};

const pagoInsertado = {
  id_pago: 11,
  id_deuda: 1,
  monto: "30.00",
  id_usuario: testUserDueno.id_usuario,
  metodo_pago: "EFECTIVO",
  nota: null,
};

describe("POST /api/deudas/:id/pagos", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRecalcular.mockResolvedValue({
      id_cliente: 7,
      deuda_pendiente: 70,
      limite_deuda: null,
      bloqueado: false,
      cambioEstado: false,
    });
  });

  it("returns 403 when unauthenticated", async () => {
    const req = createMockRequest(`/api/deudas/1/pagos`, {
      method: "POST",
      body: { monto: 10 },
    });
    const res = await POST(req, { params: { id: "1" } });
    expect(res.status).toBe(403);
    expect(mockPool.connect).not.toHaveBeenCalled();
  });

  it("allows a colaborador (EMPLEADO) to register a payment", async () => {
    const client = makeClient();
    client.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // BEGIN
    client.query.mockResolvedValueOnce({ rows: [deudaPendiente], rowCount: 1 });
    client.query.mockResolvedValueOnce({ rows: [{ total: 0 }] });
    client.query.mockResolvedValueOnce({ rows: [pagoInsertado] });
    client.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // COMMIT

    const req = createMockRequest(`/api/deudas/1/pagos`, {
      method: "POST",
      user: testUserEmpleado,
      body: { monto: 30, metodo_pago: "EFECTIVO" },
    });
    const res = await POST(req, { params: { id: "1" } });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.saldo_pendiente).toBe(70);
    expect(data.estado_deuda).toBe("PENDIENTE");
    expect(data.pago.id_pago).toBe(11);
  });

  it("rejects a non-numeric debt id", async () => {
    const req = makeReq("abc", { monto: 10 });
    const res = await POST(req, { params: { id: "abc" } });
    expect(res.status).toBe(400);
  });

  it("rejects a monto <= 0", async () => {
    const req = makeReq("1", { monto: 0 });
    const res = await POST(req, { params: { id: "1" } });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/mayor a 0/);
  });

  it("rejects a non-numeric monto", async () => {
    const req = makeReq("1", { monto: "abc" });
    const res = await POST(req, { params: { id: "1" } });
    expect(res.status).toBe(400);
  });

  it("rejects an invalid metodo_pago type", async () => {
    const req = makeReq("1", { monto: 10, metodo_pago: 123 });
    const res = await POST(req, { params: { id: "1" } });
    expect(res.status).toBe(400);
  });

  it("returns 400 when the deuda does not exist", async () => {
    const client = makeClient();
    client.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // BEGIN
    client.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // SELECT deuda
    client.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // ROLLBACK

    const req = makeReq("99", { monto: 10 });
    const res = await POST(req, { params: { id: "99" } });
    expect(res.status).toBe(400);
    expect(client.query).toHaveBeenCalledWith("ROLLBACK");
    expect(client.release).toHaveBeenCalled();
  });

  it("returns 400 when the deuda is already PAGADA", async () => {
    const client = makeClient();
    client.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // BEGIN
    client.query.mockResolvedValueOnce({
      rows: [{ ...deudaPendiente, estado_deuda: "PAGADA" }],
      rowCount: 1,
    });
    client.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // ROLLBACK

    const req = makeReq("1", { monto: 10 });
    const res = await POST(req, { params: { id: "1" } });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/ya está marcada como pagada/);
  });

  it("rejects a payment larger than the remaining balance", async () => {
    const client = makeClient();
    client.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // BEGIN
    client.query.mockResolvedValueOnce({ rows: [deudaPendiente], rowCount: 1 });
    client.query.mockResolvedValueOnce({ rows: [{ total: 40 }] }); // ya pagó 40, saldo 60
    client.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // ROLLBACK

    const req = makeReq("1", { monto: 100 });
    const res = await POST(req, { params: { id: "1" } });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/mayor al saldo pendiente/);
    expect(client.query).toHaveBeenCalledWith("ROLLBACK");
  });

  it("accepts a payment equal to the remaining balance (tolerance for rounding)", async () => {
    const client = makeClient();
    client.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // BEGIN
    client.query.mockResolvedValueOnce({ rows: [deudaPendiente], rowCount: 1 });
    client.query.mockResolvedValueOnce({ rows: [{ total: 60 }] }); // saldo 40
    client.query.mockResolvedValueOnce({ rows: [pagoInsertado] });
    client.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // COMMIT

    const req = makeReq("1", { monto: 40.01 });
    const res = await POST(req, { params: { id: "1" } });
    expect(res.status).toBe(201);
  });

  it("marks the deuda as PAGADA when the payment covers the full balance", async () => {
    const client = makeClient();
    client.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // BEGIN
    client.query.mockResolvedValueOnce({ rows: [deudaPendiente], rowCount: 1 });
    client.query.mockResolvedValueOnce({ rows: [{ total: 0 }] });
    client.query.mockResolvedValueOnce({ rows: [pagoInsertado] });
    client.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // UPDATE deuda PAGADA
    client.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // COMMIT

    const req = makeReq("1", { monto: 100 });
    const res = await POST(req, { params: { id: "1" } });
    const data = await res.json();
    expect(res.status).toBe(201);
    expect(data.estado_deuda).toBe("PAGADA");
    expect(data.saldo_pendiente).toBe(0);

    const updateCall = client.query.mock.calls.find(
      (c: unknown[]) => (c[0] as string).includes("UPDATE deuda")
    );
    expect(updateCall?.[0]).toContain("PAGADA");
  });

  it("recalculates the client block after a partial payment", async () => {
    const client = makeClient();
    client.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // BEGIN
    client.query.mockResolvedValueOnce({ rows: [deudaPendiente], rowCount: 1 });
    client.query.mockResolvedValueOnce({ rows: [{ total: 0 }] });
    client.query.mockResolvedValueOnce({ rows: [pagoInsertado] });
    client.query.mockResolvedValueOnce({ rows: [{ limite_deuda: 90, estado_cliente: false }] }); // recalcular: SELECT
    client.query.mockResolvedValueOnce({
      rows: [{ total: 70 }],
    }); // recalcular: SELECT suma
    client.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // recalcular: UPDATE cliente si cambia
    client.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // COMMIT

    const req = makeReq("1", { monto: 30 });
    const res = await POST(req, { params: { id: "1" } });
    const data = await res.json();
    expect(res.status).toBe(201);
    expect(mockRecalcular).toHaveBeenCalledWith(client, 7);
    expect(data.alerta).toEqual({
      id_cliente: 7,
      deuda_pendiente: 70,
      limite_deuda: null,
      bloqueado: false,
      cambioEstado: false,
    });
  });

  it("does not recalculate anything when the deuda has no linked cliente", async () => {
    const client = makeClient();
    client.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // BEGIN
    client.query.mockResolvedValueOnce({
      rows: [{ ...deudaPendiente, id_cliente: null }],
      rowCount: 1,
    });
    client.query.mockResolvedValueOnce({ rows: [{ total: 0 }] });
    client.query.mockResolvedValueOnce({ rows: [pagoInsertado] });
    client.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // COMMIT

    const req = makeReq("1", { monto: 30 });
    const res = await POST(req, { params: { id: "1" } });
    const data = await res.json();
    expect(res.status).toBe(201);
    expect(mockRecalcular).not.toHaveBeenCalled();
    expect(data.alerta).toBeNull();
  });

  it("rolls back and returns 500 if a query fails", async () => {
    const client = makeClient();
    client.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // BEGIN
    client.query.mockRejectedValueOnce(new Error("boom"));
    client.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // ROLLBACK

    const req = makeReq("1", { monto: 30 });
    const res = await POST(req, { params: { id: "1" } });
    expect(res.status).toBe(500);
    expect(client.query).toHaveBeenCalledWith("ROLLBACK");
    expect(client.release).toHaveBeenCalled();
  });
});