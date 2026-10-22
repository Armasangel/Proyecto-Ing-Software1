import { GET, POST } from "@/app/api/clientes/route";
import { PATCH } from "@/app/api/clientes/[id]/route";
import { createMockRequest, testUserDueno, testUserEmpleado, mockQueryResult } from "@/__tests__/utils/api-test-utils";

jest.mock("@/lib/db", () => ({
  pool: { query: jest.fn(), connect: jest.fn() },
}));

jest.mock("@/lib/deuda-alertas", () => ({
  recalcularBloqueoCliente: jest.fn().mockResolvedValue({ bloqueado: false }),
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

  it("exposes the es_consumidor_final flag so Ventas can pin it and block credit", async () => {
    const req = createMockRequest("/api/clientes", { user: testUserDueno });
    await GET(req);
    const sql = mockPool.query.mock.calls[0][0] as string;
    expect(sql).toContain("es_consumidor_final");
  });

  it("exposes nit_cliente, codigo_postal and direccion for the listing", async () => {
    const req = createMockRequest("/api/clientes", { user: testUserDueno });
    await GET(req);
    const sql = mockPool.query.mock.calls[0][0] as string;
    expect(sql).toContain("nit_cliente");
    expect(sql).toContain("codigo_postal");
    expect(sql).toContain("direccion");
  });
});

describe("POST /api/clientes — datos del cliente", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPool.query.mockResolvedValue(mockQueryResult([{ id_cliente: 7 }]));
  });

  function post(body: unknown, user = testUserDueno) {
    return POST(createMockRequest("/api/clientes", { method: "POST", body, user }));
  }

  it("rejects unauthenticated requests", async () => {
    const res = await POST(createMockRequest("/api/clientes", { method: "POST", body: { nombre: "X" } }));
    expect(res.status).toBe(403);
    expect(mockPool.query).not.toHaveBeenCalled();
  });

  it("stores NIT, código postal y dirección (recortados) y acepta tipo EMPRESA", async () => {
    const res = await post({
      nombre: "  Distribuidora X  ",
      correo: "x@correo.com",
      telefono: "55551234",
      tipo_cliente: "EMPRESA",
      nit_cliente: " 1234567-8 ",
      codigo_postal: " 01001 ",
      direccion: " 6a. avenida 12-34, zona 1 ",
    });
    expect(res.status).toBe(201);

    const [sql, params] = mockPool.query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("INSERT INTO cliente");
    expect(params).toEqual([
      "Distribuidora X",
      "x@correo.com",
      "55551234",
      "EMPRESA",
      null,
      "1234567-8",
      "01001",
      "6a. avenida 12-34, zona 1",
    ]);
  });

  it("saves 'CF' and NULLs when the optional fields are empty", async () => {
    const res = await post({ nombre: "Sin NIT", correo: null });
    expect(res.status).toBe(201);

    const [, params] = mockPool.query.mock.calls[0] as [string, unknown[]];
    // [nombre, correo, telefono, tipo, limite, nit, codigo_postal, direccion]
    expect(params.slice(4)).toEqual([null, "CF", null, null]);
    expect(params[3]).toBe("MINORISTA");
  });

  it("accepts GOBIERNO as tipo and falls back to MINORISTA for unknown types", async () => {
    await post({ nombre: "Muni", tipo_cliente: "GOBIERNO" });
    expect((mockPool.query.mock.calls[0] as [string, unknown[]])[1][3]).toBe("GOBIERNO");

    await post({ nombre: "Otro", tipo_cliente: "PARTICULAR" });
    expect((mockPool.query.mock.calls[1] as [string, unknown[]])[1][3]).toBe("MINORISTA");
  });

  it("rejects a NIT, código postal or dirección longer than the column", async () => {
    const largo = (n: number) => "X".repeat(n);
    for (const body of [
      { nombre: "A", nit_cliente: largo(21) },
      { nombre: "A", codigo_postal: largo(11) },
      { nombre: "A", direccion: largo(256) },
    ]) {
      const res = await post(body);
      expect(res.status).toBe(400);
    }
    expect(mockPool.query).not.toHaveBeenCalled();
  });

  it("still requires the nombre", async () => {
    const res = await post({ nombre: "   " });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/nombre del cliente es obligatorio/);
    expect(mockPool.query).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/clientes/:id — límite de deuda", () => {
  function makeClient(fila: { es_consumidor_final: boolean }) {
    const client = { query: jest.fn(), release: jest.fn() };
    // BEGIN, SELECT del cliente, (UPDATE), (recalcularBloqueo), COMMIT/ROLLBACK
    client.query.mockImplementation((sql: string) => {
      if (sql.startsWith("SELECT")) {
        return Promise.resolve({ rows: [fila], rowCount: 1 });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });
    return client;
  }

  const mockConnect = (jest.requireMock("@/lib/db").pool as { connect: jest.Mock }).connect;
  const mockRecalcular = jest.requireMock("@/lib/deuda-alertas").recalcularBloqueoCliente as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRecalcular.mockResolvedValue({ bloqueado: false });
  });

  it("rejects assigning a credit limit to the Consumidor Final client", async () => {
    const client = makeClient({ es_consumidor_final: true });
    mockConnect.mockResolvedValue(client);
    const req = createMockRequest("/api/clientes/3", {
      method: "PATCH",
      user: testUserDueno,
      body: { limite_deuda: 500 },
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "3" }) });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/Consumidor Final no puede tener límite de crédito/);

    const escribio = client.query.mock.calls.some((c) =>
      (c[0] as string).includes("UPDATE cliente")
    );
    expect(escribio).toBe(false);
    expect(client.release).toHaveBeenCalled();
  });

  it("allows the owner to set a credit limit on a regular client", async () => {
    const client = makeClient({ es_consumidor_final: false });
    mockConnect.mockResolvedValue(client);
    const req = createMockRequest("/api/clientes/1", {
      method: "PATCH",
      user: testUserDueno,
      body: { limite_deuda: 500 },
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(200);

    const update = client.query.mock.calls.find((c) =>
      (c[0] as string).includes("UPDATE cliente")
    );
    expect(update?.[1]).toEqual([500, 1]);
  });

  it("rejects a non-owner even for the generic client", async () => {
    const req = createMockRequest("/api/clientes/3", {
      method: "PATCH",
      user: testUserEmpleado,
      body: { limite_deuda: 100 },
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "3" }) });
    expect(res.status).toBe(403);
    expect(mockConnect).not.toHaveBeenCalled();
  });
});
