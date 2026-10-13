import { GET as clientesFrecuentes } from "@/app/api/clientes/frecuentes/route";
import { GET as productosFrecuentes } from "@/app/api/productos/frecuentes/route";
import { POST as salida } from "@/app/api/inventario/salida/route";
import { createMockRequest, testUserDueno, testUserEmpleado } from "@/__tests__/utils/api-test-utils";

jest.mock("@/lib/db", () => ({
  pool: { query: jest.fn(), connect: jest.fn() },
}));

const mockPool = jest.requireMock("@/lib/db").pool as { query: jest.Mock; connect: jest.Mock };

const bodeguero = { ...testUserEmpleado, id_usuario: 99, tipo_usuario: "BODEGUERO", id_bodega: 3 } as typeof testUserEmpleado;

beforeEach(() => jest.resetAllMocks());

describe("GET /api/clientes/frecuentes", () => {
  it("returns 403 without a staff session", async () => {
    const res = await clientesFrecuentes(createMockRequest("/api/clientes/frecuentes"));
    expect(res.status).toBe(403);
    const resBodega = await clientesFrecuentes(createMockRequest("/api/clientes/frecuentes", { user: bodeguero }));
    expect(resBodega.status).toBe(403);
  });

  it("returns the top clients, 5 by default", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [{ id_cliente: 1, nombre: "Ana", total_ordenes: 4 }] });
    const res = await clientesFrecuentes(createMockRequest("/api/clientes/frecuentes", { user: testUserEmpleado }));
    expect(res.status).toBe(200);
    expect((await res.json()).clientes).toHaveLength(1);
    expect(mockPool.query.mock.calls[0][1][0]).toBe(5);
    expect(String(mockPool.query.mock.calls[0][0])).toMatch(/estado_cliente = TRUE/);
    expect(String(mockPool.query.mock.calls[0][0])).toMatch(/<> 'CANCELADO'/);
  });

  it("caps the limit", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });
    await clientesFrecuentes(createMockRequest("/api/clientes/frecuentes?limit=500", { user: testUserDueno }));
    expect(mockPool.query.mock.calls[0][1][0]).toBe(20);
  });
});

describe("GET /api/productos/frecuentes", () => {
  it("returns 403 without a session", async () => {
    const res = await productosFrecuentes(createMockRequest("/api/productos/frecuentes"));
    expect(res.status).toBe(403);
  });

  it("returns 5 random products by default, filtered by stock in the bodeguero's bodega when asked", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [{ id_producto: 7, nombre_producto: "Frijol" }] });
    const res = await productosFrecuentes(
      createMockRequest("/api/productos/frecuentes?con_stock=1", { user: bodeguero })
    );
    expect(res.status).toBe(200);
    expect(String(mockPool.query.mock.calls[0][0])).toMatch(/ORDER BY RANDOM\(\)/);
    // [idBodega, limite, soloConStock]
    expect(mockPool.query.mock.calls[0][1]).toEqual([3, 5, true]);
  });

  it("ignores con_stock for staff (no bodega)", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });
    await productosFrecuentes(createMockRequest("/api/productos/frecuentes?con_stock=1", { user: testUserDueno }));
    expect(mockPool.query.mock.calls[0][1]).toEqual([null, 5, false]);
  });

  it("ranks by recent sales/orders with orden=frecuentes", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });
    await productosFrecuentes(createMockRequest("/api/productos/frecuentes?orden=frecuentes", { user: bodeguero }));
    expect(String(mockPool.query.mock.calls[0][0])).toMatch(/popularidad/);
    // [idBodega, limite, ventanaDias, soloConStock]
    expect(mockPool.query.mock.calls[0][1]).toEqual([3, 5, 90, false]);
  });
});

describe("POST /api/inventario/salida", () => {
  const req = (motivo: string) =>
    createMockRequest("/api/inventario/salida", {
      method: "POST",
      user: bodeguero,
      body: { id_producto: 1, cantidad: 2, motivo },
    });

  it("no longer accepts USO_INTERNO as a motivo", async () => {
    const res = await salida(req("USO_INTERNO"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/MERMA/);
    expect(mockPool.connect).not.toHaveBeenCalled();
  });

  it("still accepts MERMA", async () => {
    const client = { query: jest.fn().mockResolvedValue({ rows: [{ cantidad_disponible: 10 }], rowCount: 1 }), release: jest.fn() };
    mockPool.connect.mockResolvedValue(client);
    const res = await salida(req("MERMA"));
    expect(res.status).toBe(200);
    const insert = client.query.mock.calls.find((c) => String(c[0]).includes("INSERT INTO kardex"));
    expect(insert?.[1]).toEqual(expect.arrayContaining(["MERMA"]));
  });
});
