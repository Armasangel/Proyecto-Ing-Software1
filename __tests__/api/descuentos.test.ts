import { GET, POST } from "@/app/api/descuentos/route";
import { PUT, PATCH, DELETE } from "@/app/api/descuentos/[id]/route";
import { POST as POST_ASIG, DELETE as DELETE_ASIG } from "@/app/api/descuentos/[id]/asignaciones/route";
import { GET as GET_APLICABLES } from "@/app/api/descuentos/aplicables/route";
import { createMockRequest, testUserDueno, testUserEmpleado } from "@/__tests__/utils/api-test-utils";

jest.mock("@/lib/db", () => ({
  pool: { query: jest.fn(), connect: jest.fn() },
}));

const mockPool = jest.requireMock("@/lib/db").pool as { query: jest.Mock; connect: jest.Mock };

function makeClient() {
  const client = { query: jest.fn(), release: jest.fn() };
  mockPool.connect.mockResolvedValue(client);
  return client;
}

const ctx = (id: number | string) => ({ params: Promise.resolve({ id: String(id) }) });

const tramoValido = { cantidad_desde: 10, porcentaje: 5 };

describe("GET /api/descuentos", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 403 for unauthenticated", async () => {
    const res = await GET(createMockRequest("/api/descuentos"));
    expect(res.status).toBe(403);
  });

  it("returns 403 for a non-owner (empleado)", async () => {
    const res = await GET(createMockRequest("/api/descuentos", { user: testUserEmpleado }));
    expect(res.status).toBe(403);
  });

  it("merges tramos and asignaciones per rule for the owner", async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [{ id_descuento: 1, nombre: "Mayoreo", tipo: "CANTIDAD", activo: true }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ id_tramo: 1, id_descuento: 1, cantidad_desde: "10", porcentaje: "5" }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ id_asignacion: 1, id_descuento: 1, id_cliente: null, tipo_cliente: "MAYORISTA" }], rowCount: 1 });

    const res = await GET(createMockRequest("/api/descuentos", { user: testUserDueno }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.descuentos).toHaveLength(1);
    expect(data.descuentos[0].tramos).toHaveLength(1);
    expect(data.descuentos[0].asignaciones).toHaveLength(1);
  });

  it("returns an empty list without extra queries when there are no rules", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const res = await GET(createMockRequest("/api/descuentos", { user: testUserDueno }));
    expect(res.status).toBe(200);
    expect((await res.json()).descuentos).toEqual([]);
    expect(mockPool.query).toHaveBeenCalledTimes(1);
  });
});

describe("POST /api/descuentos", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 403 for a non-owner", async () => {
    const res = await POST(createMockRequest("/api/descuentos", {
      method: "POST", user: testUserEmpleado,
      body: { nombre: "X", tipo: "PORCENTAJE", tramos: [tramoValido] },
    }));
    expect(res.status).toBe(403);
  });

  it("rejects an invalid rule", async () => {
    const res = await POST(createMockRequest("/api/descuentos", {
      method: "POST", user: testUserDueno,
      body: { nombre: "", tipo: "PORCENTAJE", tramos: [] },
    }));
    expect(res.status).toBe(400);
    expect(mockPool.connect).not.toHaveBeenCalled();
  });

  it("creates the rule with its tramos", async () => {
    const client = makeClient();
    client.query
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // BEGIN
      .mockResolvedValueOnce({ rows: [{ id_descuento: 42 }], rowCount: 1 }) // INSERT descuento
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // INSERT tramo
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }); // COMMIT

    const res = await POST(createMockRequest("/api/descuentos", {
      method: "POST", user: testUserDueno,
      body: { nombre: "Mayoreo", tipo: "CANTIDAD", tramos: [tramoValido] },
    }));
    expect(res.status).toBe(201);
    expect((await res.json()).id_descuento).toBe(42);
  });
});

describe("PUT/PATCH/DELETE /api/descuentos/[id]", () => {
  beforeEach(() => jest.clearAllMocks());

  it("PUT returns 403 for a non-owner", async () => {
    const res = await PUT(createMockRequest("/api/descuentos/1", {
      method: "PUT", user: testUserEmpleado,
      body: { nombre: "X", tipo: "PORCENTAJE", tramos: [tramoValido] },
    }), ctx(1));
    expect(res.status).toBe(403);
  });

  it("PUT replaces tramos inside a transaction", async () => {
    const client = makeClient();
    client.query
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // BEGIN
      .mockResolvedValueOnce({ rows: [{ id_descuento: 1 }], rowCount: 1 }) // UPDATE descuento
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // DELETE tramos
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // INSERT tramo
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }); // COMMIT

    const res = await PUT(createMockRequest("/api/descuentos/1", {
      method: "PUT", user: testUserDueno,
      body: { nombre: "Mayoreo", tipo: "ESCALA", tramos: [tramoValido] },
    }), ctx(1));
    expect(res.status).toBe(200);
    const deleteCall = client.query.mock.calls.find((c) => (c[0] as string).includes("DELETE FROM descuento_tramo"));
    expect(deleteCall).toBeDefined();
  });

  it("PUT returns 404 when the rule doesn't exist", async () => {
    const client = makeClient();
    client.query
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // BEGIN
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }); // UPDATE (nothing)
    const res = await PUT(createMockRequest("/api/descuentos/999", {
      method: "PUT", user: testUserDueno,
      body: { nombre: "X", tipo: "PORCENTAJE", tramos: [tramoValido] },
    }), ctx(999));
    expect(res.status).toBe(404);
  });

  it("PATCH toggles activo", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [{ id_descuento: 1 }], rowCount: 1 });
    const res = await PATCH(createMockRequest("/api/descuentos/1", {
      method: "PATCH", user: testUserDueno, body: { activo: false },
    }), ctx(1));
    expect(res.status).toBe(200);
    expect(mockPool.query.mock.calls[0][1]).toEqual([false, 1]);
  });

  it("PATCH rejects a non-boolean activo", async () => {
    const res = await PATCH(createMockRequest("/api/descuentos/1", {
      method: "PATCH", user: testUserDueno, body: { activo: "no" },
    }), ctx(1));
    expect(res.status).toBe(400);
  });

  it("DELETE removes the rule", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [{ id_descuento: 1 }], rowCount: 1 });
    const res = await DELETE(createMockRequest("/api/descuentos/1", { method: "DELETE", user: testUserDueno }), ctx(1));
    expect(res.status).toBe(200);
  });
});

describe("POST/DELETE /api/descuentos/[id]/asignaciones", () => {
  beforeEach(() => jest.clearAllMocks());

  it("POST rejects assigning to both targets", async () => {
    const res = await POST_ASIG(createMockRequest("/api/descuentos/1/asignaciones", {
      method: "POST", user: testUserDueno, body: { id_cliente: 1, tipo_cliente: "MAYORISTA" },
    }), ctx(1));
    expect(res.status).toBe(400);
    expect(mockPool.query).not.toHaveBeenCalled();
  });

  it("POST assigns to a tipo_cliente", async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [{ "?column?": 1 }], rowCount: 1 }) // regla existe
      .mockResolvedValueOnce({ rows: [{ id_asignacion: 5 }], rowCount: 1 }); // INSERT asignacion
    const res = await POST_ASIG(createMockRequest("/api/descuentos/1/asignaciones", {
      method: "POST", user: testUserDueno, body: { tipo_cliente: "MAYORISTA" },
    }), ctx(1));
    expect(res.status).toBe(201);
    expect((await res.json()).id_asignacion).toBe(5);
  });

  it("DELETE requires id_asignacion", async () => {
    const res = await DELETE_ASIG(createMockRequest("/api/descuentos/1/asignaciones", {
      method: "DELETE", user: testUserDueno,
    }), ctx(1));
    expect(res.status).toBe(400);
  });
});

describe("GET /api/descuentos/aplicables", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 403 for unauthenticated", async () => {
    const res = await GET_APLICABLES(createMockRequest("/api/descuentos/aplicables?id_cliente=1"));
    expect(res.status).toBe(403);
  });

  it("is available to a colaborador too", async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [{ tipo_cliente: "MAYORISTA" }], rowCount: 1 }) // cliente
      .mockResolvedValueOnce({ rows: [{ id_descuento: 1, nombre: "Mayoreo", tipo: "CANTIDAD" }], rowCount: 1 }) // reglas
      .mockResolvedValueOnce({ rows: [{ id_descuento: 1, cantidad_desde: "10", porcentaje: "5" }], rowCount: 1 }); // tramos
    const res = await GET_APLICABLES(createMockRequest("/api/descuentos/aplicables?id_cliente=1", { user: testUserEmpleado }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.descuentos[0].tramos[0].porcentaje).toBe(5);
  });

  it("rejects a missing id_cliente", async () => {
    const res = await GET_APLICABLES(createMockRequest("/api/descuentos/aplicables", { user: testUserEmpleado }));
    expect(res.status).toBe(400);
  });
});
