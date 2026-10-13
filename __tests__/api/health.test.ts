import { GET } from "@/app/api/health/route";
import { createMockRequest } from "@/__tests__/utils/api-test-utils";

jest.mock("@/lib/db", () => ({
  pool: { query: jest.fn(), connect: jest.fn() },
}));

const mockPool = jest.requireMock("@/lib/db").pool as { query: jest.Mock };

describe("GET /api/health", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 200 with server time on success", async () => {
    mockPool.query.mockResolvedValue({
      rows: [{ hora_servidor: "2026-07-28T12:00:00Z", base_de_datos: "test_db" }],
    });
    const req = createMockRequest("/api/health");
    const res = await GET();
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.status).toBe("ok");
    expect(data.hora_servidor).toBe("2026-07-28T12:00:00Z");
  });

  it("no expone el nombre de la base de datos", async () => {
    // El nombre de la base es información de infraestructura: sirve para
    // sondear la topología interna y no aporta nada al cliente del health check.
    mockPool.query.mockResolvedValue({
      rows: [{ hora_servidor: "2026-07-28T12:00:00Z", base_de_datos: "test_db" }],
    });
    const res = await GET();
    const cuerpo = await res.text();
    expect(cuerpo).not.toContain("base_de_datos");
    expect(cuerpo).not.toContain("test_db");
  });

  it("returns 500 on DB failure without leaking the raw error", async () => {
    // El mensaje crudo de `pg` puede traer host, puerto, tabla o SQLSTATE.
    // Va solo al log del servidor (cubierto por logger.error en la ruta).
    mockPool.query.mockRejectedValue(new Error("connection refused"));
    const req = createMockRequest("/api/health");
    const res = await GET();
    const data = await res.json();
    expect(res.status).toBe(500);
    expect(data.status).toBe("error");
    expect(data.detalle).toBe("Revisa los logs del servidor");
    expect(data.detalle).not.toContain("connection refused");
  });

  it("corta la espera si la base no responde", async () => {
    // Si la consulta nunca resuelve, un health check sin timeout también
    // queda colgado, y eso es indistinguible de "todo bien" para el monitoreo
    // externo. Con el timeout, responde 500 en 5 s aunque `pool.query` no
    // haya retornado nunca.
    jest.useFakeTimers();
    mockPool.query.mockReturnValue(new Promise(() => {}));

    const pendiente = GET();
    // Se adelanta el reloj más allá del TIMEOUT_MS del route.
    jest.advanceTimersByTime(6000);

    const res = await pendiente;
    jest.useRealTimers();

    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.status).toBe("error");
    expect(data.detalle).toBe("Revisa los logs del servidor");
  });
});