import { PUT } from "@/app/api/productos/[id]/route";
import { createMockRequest, testUserDueno, testUserEmpleado } from "@/__tests__/utils/api-test-utils";

jest.mock("@/lib/db", () => ({ pool: { connect: jest.fn() } }));
const pool = jest.requireMock("@/lib/db").pool;
const client = { query: jest.fn(), release: jest.fn() };
const params = { params: Promise.resolve({ id: "1" }) };
const base = { codigo_producto: "ARR-001", nombre_producto: "Arroz", unidad_medida: "libra", id_categoria: 1, id_marca: 1 };
const existentes = [
  { id_presentacion: 7, nombre_presentacion: "Libra", factor_conversion: "1.000", unidad_base: "libra" },
  { id_presentacion: 8, nombre_presentacion: "Saco", factor_conversion: "50.000", unidad_base: "libra" },
];
const editar = (body: object) => PUT(createMockRequest("/api/productos/1", { method: "PUT", user: testUserDueno, body }), params);

describe("Product presentation editing", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    pool.connect.mockResolvedValue(client);
    client.query.mockImplementation(async (sql: string) => {
      if (sql.startsWith("SELECT id_producto")) return { rows: [{ id_producto: 1, unidad_medida: "libra" }], rowCount: 1 };
      if (sql.startsWith("SELECT id_presentacion")) return { rows: existentes, rowCount: 2 };
      if (sql.startsWith("SELECT 1 FROM presentacion_producto")) return { rows: [{}], rowCount: 1 };
      return { rows: [{ id_producto: 1 }], rowCount: 1 };
    });
  });

  it("keeps historical IDs, deactivates removals and inserts new conversions in one transaction", async () => {
    const res = await editar({ ...base, presentaciones: [
      { id_presentacion: 7, nombre_presentacion: "Libra", factor_conversion: 1 },
      { nombre_presentacion: "Arroba", factor_conversion: 25 },
    ] });
    expect(res.status).toBe(200);
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining("estado_presentacion = (id_presentacion = ANY"), [1, [7]]);
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO presentacion_producto"), [1, "Arroba", 25, "libra"]);
    expect(client.query).toHaveBeenLastCalledWith("COMMIT");
    expect(client.query.mock.calls.some(([sql]) => sql.includes("DELETE FROM"))).toBe(false);
    expect(client.release).toHaveBeenCalled();
  });

  it("reselecting an existing or inactive conversion reuses its original ID", async () => {
    expect((await editar({ ...base, presentaciones: [{ nombre_presentacion: "Saco", factor_conversion: 50 }] })).status).toBe(200);
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining("estado_presentacion = (id_presentacion = ANY"), [1, [8]]);
    expect(client.query.mock.calls.some(([sql]) => sql.includes("INSERT INTO presentacion_producto"))).toBe(false);
  });

  it.each([
    { id_presentacion: 999, nombre_presentacion: "Ajena", factor_conversion: 2 },
    { id_presentacion: 8, nombre_presentacion: "Saco", factor_conversion: 100 },
    { nombre_presentacion: "Saco", factor_conversion: 100 },
  ])("rejects foreign IDs or changing an existing conversion", async (presentacion) => {
    expect((await editar({ ...base, presentaciones: [presentacion] })).status).toBe(400);
    expect(client.query).toHaveBeenLastCalledWith("ROLLBACK");
    expect(client.query).not.toHaveBeenCalledWith("COMMIT");
  });

  it("requires selecting new presentations when changing the base unit", async () => {
    expect((await editar({ ...base, unidad_medida: "litro" })).status).toBe(400);
    expect(client.query).toHaveBeenLastCalledWith("ROLLBACK");
  });

  it("allows correcting litres to bottles and saves new presentations without converting quantities or prices", async () => {
    client.query.mockImplementation(async (sql: string) => {
      if (sql.startsWith("SELECT id_producto")) return { rows: [{ id_producto: 1, unidad_medida: "litro" }], rowCount: 1 };
      if (sql.startsWith("SELECT id_presentacion")) return { rows: [
        { id_presentacion: 9, nombre_presentacion: "Litro", factor_conversion: "1.000", unidad_base: "litro" },
        { id_presentacion: 10, nombre_presentacion: "Caja", factor_conversion: "12.000", unidad_base: "litro" },
      ] };
      return { rows: [{ id_producto: 1 }], rowCount: 1 };
    });
    const res = await editar({ ...base, unidad_medida: "botella", precio_unitario: 18, presentaciones: [
      { nombre_presentacion: "Botella", factor_conversion: 1 },
      { nombre_presentacion: "Caja", factor_conversion: 24 },
    ] });
    expect(res.status).toBe(200);
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining("estado_presentacion = (id_presentacion = ANY"), [1, []]);
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO presentacion_producto"), [1, "Caja", 24, "botella"]);
    const update = client.query.mock.calls.find(([sql]) => sql.startsWith("UPDATE producto"));
    expect(update[1][2]).toBe(18);
    expect(update[1][4]).toBe("botella");
    expect(client.query.mock.calls.some(([sql]) => /UPDATE (bodega_producto|kardex|detalle_venta|detalle_orden)/.test(sql))).toBe(false);
    expect(client.query).toHaveBeenLastCalledWith("COMMIT");
  });

  it("does not reuse presentation IDs from a previous base unit", async () => {
    const res = await editar({ ...base, unidad_medida: "botella", presentaciones: [
      { id_presentacion: 7, nombre_presentacion: "Libra", factor_conversion: 1 },
    ] });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("unidad anterior");
    expect(client.query).toHaveBeenLastCalledWith("ROLLBACK");
  });

  it("reuses the original ID when switching back to a previous unit", async () => {
    const original = client.query.getMockImplementation()!;
    client.query.mockImplementation((sql: string, ...args: unknown[]) => sql.startsWith("SELECT id_producto")
      ? Promise.resolve({ rows: [{ id_producto: 1, unidad_medida: "botella" }], rowCount: 1 })
      : original(sql, ...args));
    expect((await editar({ ...base, presentaciones: [{ nombre_presentacion: "Saco", factor_conversion: 50 }] })).status).toBe(200);
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining("estado_presentacion = (id_presentacion = ANY"), [1, [8]]);
    expect(client.query.mock.calls.some(([sql]) => sql.includes("INSERT INTO presentacion_producto"))).toBe(false);
  });

  it("accepts aliases of the same unit without changing conversions", async () => {
    expect((await editar({ ...base, unidad_medida: "lbs" })).status).toBe(200);
  });

  it("preserves presentations when an older client omits the field", async () => {
    expect((await editar(base)).status).toBe(200);
    expect(client.query.mock.calls.some(([sql]) => sql.startsWith("UPDATE presentacion_producto"))).toBe(false);
  });

  it("keeps presentation administration restricted to the owner", async () => {
    const res = await PUT(createMockRequest("/api/productos/1", {
      method: "PUT", user: testUserEmpleado,
      body: { ...base, presentaciones: [{ nombre_presentacion: "Caja", factor_conversion: 12 }] },
    }), params);
    expect(res.status).toBe(403);
    expect(pool.connect).not.toHaveBeenCalled();
  });

  it("saves three distinct categories and can clear the optional categories", async () => {
    expect((await editar({ ...base, id_categoria_2: 2, id_categoria_3: 3 })).status).toBe(200);
    let update = client.query.mock.calls.find(([sql]) => sql.startsWith("UPDATE producto"));
    expect(update[1].slice(12)).toEqual([2, 3]);
    client.query.mockClear();
    expect((await editar({ ...base, id_categoria_2: null, id_categoria_3: null })).status).toBe(200);
    update = client.query.mock.calls.find(([sql]) => sql.startsWith("UPDATE producto"));
    expect(update[1].slice(12)).toEqual([null, null]);
  });

  it("preserves additional categories when an older client omits them", async () => {
    const original = client.query.getMockImplementation()!;
    client.query.mockImplementation((sql: string, ...args: unknown[]) => sql.startsWith("SELECT id_producto")
      ? Promise.resolve({ rows: [{ id_producto: 1, unidad_medida: "libra", id_categoria_2: 2, id_categoria_3: 3 }], rowCount: 1 })
      : original(sql, ...args));
    expect((await editar(base)).status).toBe(200);
    const update = client.query.mock.calls.find(([sql]) => sql.startsWith("UPDATE producto"));
    expect(update[1].slice(12)).toEqual([2, 3]);
  });

  it.each([
    { id_categoria_2: 1 }, { id_categoria_2: 2, id_categoria_3: 2 }, { id_categoria_2: -1 }, { id_categoria_3: 1.5 },
  ])("rejects repeated or invalid categories", async (extras) => {
    expect((await editar({ ...base, ...extras })).status).toBe(400);
    expect(pool.connect).not.toHaveBeenCalled();
  });

  it.each([
    { presentaciones: [] },
    { presentaciones: [{ nombre_presentacion: "Caja", factor_conversion: 0 }] },
    { presentaciones: [{ nombre_presentacion: "Caja", factor_conversion: 0.0001 }] },
  ])("rejects empty or invalid conversions before writing", async ({ presentaciones }) => {
    expect((await editar({ ...base, presentaciones })).status).toBe(400);
    expect(pool.connect).not.toHaveBeenCalled();
  });

  it("rolls back the product if saving presentations fails", async () => {
    const original = client.query.getMockImplementation()!;
    client.query.mockImplementation((sql: string, ...args: unknown[]) => {
      if (sql.includes("INSERT INTO presentacion_producto")) throw new Error("Database unavailable");
      return original(sql, ...args);
    });
    expect((await editar({ ...base, presentaciones: [{ nombre_presentacion: "Nueva", factor_conversion: 3 }] })).status).toBe(500);
    expect(client.query).toHaveBeenLastCalledWith("ROLLBACK");
    expect(client.release).toHaveBeenCalled();
  });
});
