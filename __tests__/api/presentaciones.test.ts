import { GET } from "@/app/api/presentaciones/route";
import { createMockRequest, testUserDueno, testUserEmpleado } from "@/__tests__/utils/api-test-utils";

jest.mock("@/lib/db", () => ({ pool: { query: jest.fn() } }));
const query = jest.requireMock("@/lib/db").pool.query as jest.Mock;

describe("GET /api/presentaciones", () => {
  beforeEach(() => { jest.clearAllMocks(); query.mockResolvedValue({ rows: [] }); });

  it("suggests conversions and reuses only presentations of the same base unit", async () => {
    query.mockResolvedValue({ rows: [{ nombre_presentacion: "Saco especial", factor_conversion: "80.000" }] });
    const res = await GET(createMockRequest("/api/presentaciones?unidad_medida=lbs", { user: testUserDueno }));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(query.mock.calls[0][1]).toEqual(["libra"]);
    expect(query.mock.calls[0][0]).toContain("pp.unidad_base = $1");
    expect(query.mock.calls[0][0]).toContain("pp.estado_presentacion = TRUE");
    expect(data.presentaciones).toEqual(expect.arrayContaining([
      { nombre_presentacion: "Arroba (25 libras)", factor_conversion: 25 },
      { nombre_presentacion: "Quintal (100 libras)", factor_conversion: 100 },
      { nombre_presentacion: "Saco especial", factor_conversion: 80 },
    ]));
    expect(data.presentaciones.every((p: { id_presentacion?: number }) => p.id_presentacion === undefined)).toBe(true);
  });

  it("does not suggest weight packages for litres", async () => {
    const res = await GET(createMockRequest("/api/presentaciones?unidad_medida=litro", { user: testUserDueno }));
    const data = await res.json();
    expect(data.presentaciones.some((p: { nombre_presentacion: string }) => /libra|arroba|quintal/i.test(p.nombre_presentacion))).toBe(false);
    expect(data.presentaciones).toContainEqual({ nombre_presentacion: "250 mililitros", factor_conversion: 0.25 });
  });

  it("still returns the actual IDs for stock and sales", async () => {
    query.mockResolvedValue({ rows: [{ id_presentacion: 17, nombre_presentacion: "Caja", factor_conversion: "12.000" }] });
    const res = await GET(createMockRequest("/api/presentaciones?id_producto=1", { user: testUserDueno }));
    expect((await res.json()).presentaciones[0].id_presentacion).toBe(17);
    expect(query.mock.calls[0][1]).toEqual([1]);
  });

  it.each(["id_producto=-1", "id_producto=1.5", "id_producto=no", ""])("rejects invalid parameters %s", async (params) => {
    const res = await GET(createMockRequest(`/api/presentaciones?${params}`, { user: testUserDueno }));
    expect(res.status).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });

  it.each([undefined, testUserEmpleado])("keeps existing access restrictions", async (user) => {
    expect((await GET(createMockRequest("/api/presentaciones?unidad_medida=libra", { user }))).status).toBe(403);
    expect(query).not.toHaveBeenCalled();
  });
});
