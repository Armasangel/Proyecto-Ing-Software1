import { GET, PATCH } from "@/app/api/configuracion/notificaciones-deuda/route";
import { createMockRequest, testUserDueno, testUserEmpleado } from "@/__tests__/utils/api-test-utils";
import { actualizarConfiguracion, obtenerConfiguracion } from "@/lib/notificaciones-deuda";

jest.mock("@/lib/notificaciones-deuda", () => ({
  obtenerConfiguracion: jest.fn(),
  actualizarConfiguracion: jest.fn(),
}));

const mockObtener = obtenerConfiguracion as jest.MockedFunction<typeof obtenerConfiguracion>;
const mockActualizar = actualizarConfiguracion as jest.MockedFunction<typeof actualizarConfiguracion>;

const configFila = {
  activo: true,
  intervalo_dias: 7,
  actualizado_en: "2026-09-01T00:00:00.000Z",
  actualizado_por: 1,
};

describe("GET /api/configuracion/notificaciones-deuda", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 403 when unauthenticated", async () => {
    const req = createMockRequest("/api/configuracion/notificaciones-deuda");
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it("allows any staff user to view it", async () => {
    mockObtener.mockResolvedValueOnce(configFila);
    const req = createMockRequest("/api/configuracion/notificaciones-deuda", { user: testUserEmpleado });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.configuracion).toEqual(configFila);
  });
});

describe("PATCH /api/configuracion/notificaciones-deuda", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 403 for a non-dueño (staff, but not owner)", async () => {
    const req = createMockRequest("/api/configuracion/notificaciones-deuda", {
      method: "PATCH",
      user: testUserEmpleado,
      body: { intervalo_dias: 10 },
    });
    const res = await PATCH(req);
    expect(res.status).toBe(403);
    expect(mockActualizar).not.toHaveBeenCalled();
  });

  it("rejects a non-boolean activo", async () => {
    const req = createMockRequest("/api/configuracion/notificaciones-deuda", {
      method: "PATCH",
      user: testUserDueno,
      body: { activo: "si" },
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
  });

  it.each([0, -1, 1.5, 366, "abc"])("rejects an invalid intervalo_dias (%p)", async (valor) => {
    const req = createMockRequest("/api/configuracion/notificaciones-deuda", {
      method: "PATCH",
      user: testUserDueno,
      body: { intervalo_dias: valor },
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
  });

  it("rejects an empty body (no changes sent)", async () => {
    const req = createMockRequest("/api/configuracion/notificaciones-deuda", {
      method: "PATCH",
      user: testUserDueno,
      body: {},
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
  });

  it("lets the dueño update activo and intervalo_dias", async () => {
    mockActualizar.mockResolvedValueOnce({ ...configFila, activo: false, intervalo_dias: 14 });
    const req = createMockRequest("/api/configuracion/notificaciones-deuda", {
      method: "PATCH",
      user: testUserDueno,
      body: { activo: false, intervalo_dias: 14 },
    });
    const res = await PATCH(req);
    expect(res.status).toBe(200);
    expect(mockActualizar).toHaveBeenCalledWith({ activo: false, intervalo_dias: 14 }, testUserDueno.id_usuario);
    const data = await res.json();
    expect(data.configuracion.intervalo_dias).toBe(14);
  });
});
