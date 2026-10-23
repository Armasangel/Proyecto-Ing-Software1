import { PATCH } from "@/app/api/proveedores/route";
import { createMockRequest, testUserDueno, testUserEmpleado } from "@/__tests__/utils/api-test-utils";

jest.mock("@/lib/db", () => ({ pool: { query: jest.fn() } }));

const mockPool = jest.requireMock("@/lib/db").pool as { query: jest.Mock };
const proveedor = {
  id_proveedor: 1,
  nombre_proveedor: "Distribuidora La Colonia",
  nit_proveedor: "12345678-9",
  correo_contacto: "ventas@colonia.com",
  telefono: "5555-1234",
};

describe("PATCH /api/proveedores", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPool.query.mockResolvedValue({ rows: [], rowCount: 1 });
  });

  it.each([true, false])("persists estado_proveedor=%s while editing", async (estado) => {
    const res = await PATCH(createMockRequest("/api/proveedores", {
      method: "PATCH", user: testUserDueno,
      body: { ...proveedor, estado_proveedor: estado },
    }));
    expect(res.status).toBe(200);
    expect(mockPool.query).toHaveBeenCalledWith(
      expect.stringContaining("estado_proveedor = COALESCE($6::boolean, estado_proveedor)"),
      [proveedor.nombre_proveedor, proveedor.nit_proveedor, proveedor.correo_contacto, proveedor.telefono, 1, estado]
    );
  });

  it("preserves the existing state when the field is omitted", async () => {
    const res = await PATCH(createMockRequest("/api/proveedores", {
      method: "PATCH", user: testUserDueno, body: proveedor,
    }));
    expect(res.status).toBe(200);
    expect(mockPool.query.mock.calls[0][1][5]).toBeNull();
  });

  it.each(["false", "true", null, 1])("rejects invalid state %s", async (estado) => {
    const res = await PATCH(createMockRequest("/api/proveedores", {
      method: "PATCH", user: testUserDueno,
      body: { ...proveedor, estado_proveedor: estado },
    }));
    expect(res.status).toBe(400);
    expect(mockPool.query).not.toHaveBeenCalled();
  });

  it.each([undefined, testUserEmpleado])("requires owner permission", async (user) => {
    const res = await PATCH(createMockRequest("/api/proveedores", {
      method: "PATCH", user, body: { ...proveedor, estado_proveedor: true },
    }));
    expect(res.status).toBe(403);
    expect(mockPool.query).not.toHaveBeenCalled();
  });
});
