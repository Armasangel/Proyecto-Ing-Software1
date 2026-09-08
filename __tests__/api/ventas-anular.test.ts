import { POST } from "@/app/api/ventas/[id]/anular/route";
import { createMockRequest, testUserDueno, testUserEmpleado } from "@/__tests__/utils/api-test-utils";

jest.mock("@/lib/db", () => ({
  pool: { query: jest.fn(), connect: jest.fn() },
}));

const mockPool = jest.requireMock("@/lib/db").pool as {
  query: jest.Mock;
  connect: jest.Mock;
};

function makeClient() {
  const client = {
    query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    release: jest.fn(),
  };
  mockPool.connect.mockResolvedValue(client);
  return client;
}

function makeReq(id: string, user: "dueno" | "empleado" | "none" = "dueno") {
  const options: { method: "POST"; user?: { id_usuario: number; nombre: string; correo: string; tipo_usuario: string } } =
    { method: "POST" };
  if (user === "dueno") options.user = testUserDueno;
  if (user === "empleado") options.user = testUserEmpleado;
  return createMockRequest(`/api/ventas/${id}/anular`, options);
}

const ventaRecienteDelDueno = {
  id_venta: 5,
  id_empleado: testUserDueno.id_usuario,
  estado_venta: "CONFIRMADO",
  fecha_venta: new Date(Date.now() - 60_000).toISOString(), // hace 1 min
};

const ventaRecienteDeOtro = {
  ...ventaRecienteDelDueno,
  id_empleado: 999,
};

const lineasConBodega = [
  { id_producto: 1, id_bodega: 2, cantidad: 3 },
  { id_producto: 2, id_bodega: 1, cantidad: 5 },
];

describe("POST /api/ventas/:id/anular", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 403 when unauthenticated", async () => {
    const req = makeReq("5", "none");
    const res = await POST(req, { params: { id: "5" } });
    expect(res.status).toBe(403);
    expect(mockPool.connect).not.toHaveBeenCalled();
  });

  it("rejects a non-numeric id", async () => {
    const req = makeReq("abc");
    const res = await POST(req, { params: { id: "abc" } });
    expect(res.status).toBe(400);
  });

  it("returns 404 when the venta does not exist", async () => {
    const client = makeClient();
    client.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // BEGIN
    client.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // SELECT venta
    client.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // ROLLBACK

    const req = makeReq("5");
    const res = await POST(req, { params: { id: "5" } });
    expect(res.status).toBe(404);
    expect(client.query).toHaveBeenCalledWith("ROLLBACK");
  });

  it("prevents a colaborador from undoing someone else's venta", async () => {
    const client = makeClient();
    client.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // BEGIN
    client.query.mockResolvedValueOnce({ rows: [ventaRecienteDeOtro], rowCount: 1 });
    client.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // ROLLBACK

    const req = makeReq("5", "empleado");
    const res = await POST(req, { params: { id: "5" } });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/tus propias ventas/);
  });

  it("allows a colaborador to undo their own venta", async () => {
    const client = makeClient();
    client.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // BEGIN
    client.query.mockResolvedValueOnce({
      rows: [{ ...ventaRecienteDelDueno, id_empleado: testUserEmpleado.id_usuario }],
      rowCount: 1,
    });
    client.query.mockResolvedValueOnce({ rows: lineasConBodega, rowCount: 2 });
    client.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // UPDATE bodega_producto (2x)
    client.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    client.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // INSERT kardex (2x)
    client.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    client.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // UPDATE venta CANCELADO
    client.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // COMMIT

    const req = makeReq("5", "empleado");
    const res = await POST(req, { params: { id: "5" } });
    expect(res.status).toBe(200);
  });

  it("rejects a venta that is already CANCELADO", async () => {
    const client = makeClient();
    client.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // BEGIN
    client.query.mockResolvedValueOnce({
      rows: [{ ...ventaRecienteDelDueno, estado_venta: "CANCELADO" }],
      rowCount: 1,
    });
    client.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // ROLLBACK

    const req = makeReq("5");
    const res = await POST(req, { params: { id: "5" } });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/ya está cancelada/);
  });

  it("rejects a venta older than the undo window (10 min)", async () => {
    const client = makeClient();
    client.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // BEGIN
    client.query.mockResolvedValueOnce({
      rows: [{ ...ventaRecienteDelDueno, fecha_venta: new Date(Date.now() - 11 * 60_000).toISOString() }],
      rowCount: 1,
    });
    client.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // ROLLBACK

    const req = makeReq("5");
    const res = await POST(req, { params: { id: "5" } });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/más de 10 minutos/);
  });

  it("accepts a venta right at the edge of the window", async () => {
    const client = makeClient();
    client.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // BEGIN
    client.query.mockResolvedValueOnce({
      rows: [{ ...ventaRecienteDelDueno, fecha_venta: new Date(Date.now() - 9.9 * 60_000).toISOString() }],
      rowCount: 1,
    });
    client.query.mockResolvedValueOnce({ rows: lineasConBodega, rowCount: 2 });
    client.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    client.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    client.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    client.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    client.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // UPDATE venta
    client.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // COMMIT

    const req = makeReq("5");
    const res = await POST(req, { params: { id: "5" } });
    expect(res.status).toBe(200);
  });

  it("rejects a venta without registered products", async () => {
    const client = makeClient();
    client.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // BEGIN
    client.query.mockResolvedValueOnce({ rows: [ventaRecienteDelDueno], rowCount: 1 });
    client.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // SELECT detalle
    client.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // ROLLBACK

    const req = makeReq("5");
    const res = await POST(req, { params: { id: "5" } });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/no tiene productos/);
  });

  it("rejects old ventas without id_bodega in the detail", async () => {
    const client = makeClient();
    client.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // BEGIN
    client.query.mockResolvedValueOnce({ rows: [ventaRecienteDelDueno], rowCount: 1 });
    client.query.mockResolvedValueOnce({
      rows: [{ id_producto: 1, id_bodega: null, cantidad: 3 }],
      rowCount: 1,
    });
    client.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // ROLLBACK

    const req = makeReq("5");
    const res = await POST(req, { params: { id: "5" } });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/antes de que existiera/);
  });

  it("restores stock, writes kardex (ENTRADA) and marks the venta CANCELADO", async () => {
    const client = makeClient();
    client.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // BEGIN
    client.query.mockResolvedValueOnce({ rows: [ventaRecienteDelDueno], rowCount: 1 });
    client.query.mockResolvedValueOnce({ rows: lineasConBodega, rowCount: 2 });
    client.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // UPDATE bodega_producto x2
    client.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    client.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // INSERT kardex x2
    client.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    client.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // UPDATE venta CANCELADO
    client.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // COMMIT

    const req = makeReq("5");
    const res = await POST(req, { params: { id: "5" } });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.mensaje).toMatch(/stock fue restaurado/);

    const stockUpdates = client.query.mock.calls.filter(
      (c: unknown[]) => (c[0] as string).startsWith("UPDATE bodega_producto")
    );
    expect(stockUpdates).toHaveLength(2);
    for (const call of stockUpdates) {
      expect((call[0] as string)).toContain("cantidad_disponible = cantidad_disponible + $1");
    }

    const kardexInserts = client.query.mock.calls.filter(
      (c: unknown[]) => (c[0] as string).includes("INSERT INTO kardex")
    );
    expect(kardexInserts).toHaveLength(2);
    for (const call of kardexInserts) {
      expect((call[0] as string)).toContain("'ENTRADA'");
      expect((call[1] as unknown[])[3]).toContain("Venta #5 deshecha");
    }

    const ventaUpdate = client.query.mock.calls.find(
      (c: unknown[]) => (c[0] as string).includes("UPDATE venta")
    );
    expect(ventaUpdate?.[0]).toContain("CANCELADO");

    expect(client.query).toHaveBeenCalledWith("COMMIT");
    expect(client.release).toHaveBeenCalled();
  });

  it("rolls back and returns 500 if a query fails", async () => {
    const client = makeClient();
    client.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // BEGIN
    client.query.mockRejectedValueOnce(new Error("boom"));
    client.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // ROLLBACK

    const req = makeReq("5");
    const res = await POST(req, { params: { id: "5" } });
    expect(res.status).toBe(500);
    expect(client.query).toHaveBeenCalledWith("ROLLBACK");
    expect(client.release).toHaveBeenCalled();
  });
});