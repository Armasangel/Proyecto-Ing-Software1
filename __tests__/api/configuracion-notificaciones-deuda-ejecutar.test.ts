import { POST } from "@/app/api/configuracion/notificaciones-deuda/ejecutar-ahora/route";
import { createMockRequest, testUserDueno, testUserEmpleado } from "@/__tests__/utils/api-test-utils";
import { checkRateLimit } from "@/lib/api-rate-limit";
import { ejecutarNotificacionesDeuda } from "@/lib/notificaciones-deuda";

jest.mock("@/lib/api-rate-limit", () => ({
  checkRateLimit: jest.fn(),
  getClientIp: jest.fn(() => "1.2.3.4"),
}));

jest.mock("@/lib/notificaciones-deuda", () => ({
  ejecutarNotificacionesDeuda: jest.fn(),
}));

const mockCheckRateLimit = checkRateLimit as jest.MockedFunction<typeof checkRateLimit>;
const mockEjecutar = ejecutarNotificacionesDeuda as jest.MockedFunction<typeof ejecutarNotificacionesDeuda>;

function makeReq(user = testUserDueno) {
  return createMockRequest("/api/configuracion/notificaciones-deuda/ejecutar-ahora", {
    method: "POST",
    user,
  });
}

describe("POST /api/configuracion/notificaciones-deuda/ejecutar-ahora", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue({ limited: false, retryAfterSeconds: 0, restantes: 3 });
  });

  it("returns 429 when rate limited", async () => {
    mockCheckRateLimit.mockResolvedValue({ limited: true, retryAfterSeconds: 30, restantes: 0 });
    const res = await POST(makeReq());
    expect(res.status).toBe(429);
    expect(mockEjecutar).not.toHaveBeenCalled();
  });

  it("returns 403 for a non-dueño", async () => {
    const res = await POST(makeReq(testUserEmpleado));
    expect(res.status).toBe(403);
    expect(mockEjecutar).not.toHaveBeenCalled();
  });

  it("returns 403 when unauthenticated", async () => {
    const req = createMockRequest("/api/configuracion/notificaciones-deuda/ejecutar-ahora", { method: "POST" });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("runs the job and returns its summary for the dueño", async () => {
    mockEjecutar.mockResolvedValueOnce({ activo: true, procesados: 3, enviados: 2, fallidos: 1 });
    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ activo: true, procesados: 3, enviados: 2, fallidos: 1 });
  });
});
