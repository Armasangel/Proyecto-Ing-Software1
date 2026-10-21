import { POST as crearCategoria } from "@/app/api/categorias/route";
import { POST as crearMarca } from "@/app/api/marcas/route";
import { createMockRequest, testUserDueno } from "@/__tests__/utils/api-test-utils";

jest.mock("@/lib/db", () => ({ pool: { query: jest.fn() } }));
const query = jest.requireMock("@/lib/db").pool.query as jest.Mock;

describe.each([
  { ruta: "categorias", crear: crearCategoria, campo: "nombre_categoria", clave: "categoria", id: "id_categoria" },
  { ruta: "marcas", crear: crearMarca, campo: "nombre_marca", clave: "marca", id: "id_marca" },
])("Creating $ruta", ({ ruta, crear, campo, clave, id }) => {
  beforeEach(() => { query.mockReset(); });
  it("creates a trimmed name and returns its ID for selection", async () => {
    query.mockResolvedValue({ rows: [{ [id]: 5, [campo]: "Nueva" }] });
    const res = await crear(createMockRequest(`/api/${ruta}`, { method: "POST", user: testUserDueno, body: { [campo]: "  Nueva  " } }));
    expect(res.status).toBe(201);
    expect((await res.json())[clave][id]).toBe(5);
    expect(query.mock.calls[0][1]).toEqual(["Nueva"]);
  });
  it.each(["", "   ", 123, "a".repeat(101)])("rejects empty, non-text or excessively long names", async (nombre) => {
    const res = await crear(createMockRequest(`/api/${ruta}`, { method: "POST", user: testUserDueno, body: { [campo]: nombre } }));
    expect(res.status).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });
  it("reports duplicates without selecting a nonexistent item", async () => {
    query.mockRejectedValue(Object.assign(new Error("duplicate"), { code: "23505" }));
    const res = await crear(createMockRequest(`/api/${ruta}`, { method: "POST", user: testUserDueno, body: { [campo]: "Nueva" } }));
    expect(res.status).toBe(409);
  });
  it("requires authentication", async () => {
    const res = await crear(createMockRequest(`/api/${ruta}`, { method: "POST", body: { [campo]: "Nueva" } }));
    expect(res.status).toBe(403);
    expect(query).not.toHaveBeenCalled();
  });
});
