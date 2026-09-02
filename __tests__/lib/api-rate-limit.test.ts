import { checkRateLimit, getClientIp } from "@/lib/api-rate-limit";

jest.mock("@/lib/db", () => ({
  pool: { query: jest.fn(), connect: jest.fn() },
}));

const mockPool = jest.requireMock("@/lib/db").pool as { query: jest.Mock };

describe("getClientIp", () => {
  function fakeReq(headers: Record<string, string | null>) {
    return { headers: { get: (name: string) => headers[name] ?? null } };
  }

  it("takes the first IP of x-forwarded-for", () => {
    expect(
      getClientIp(fakeReq({ "x-forwarded-for": "203.0.113.5, 10.0.0.1" }))
    ).toBe("203.0.113.5");
  });

  it("trims spaces from x-forwarded-for", () => {
    expect(getClientIp(fakeReq({ "x-forwarded-for": "  203.0.113.5  " }))).toBe("203.0.113.5");
  });

  it("falls back to x-real-ip when there is no x-forwarded-for", () => {
    expect(getClientIp(fakeReq({ "x-real-ip": "198.51.100.9" }))).toBe("198.51.100.9");
  });

  it("returns 'unknown' when there are no proxy headers", () => {
    expect(getClientIp(fakeReq({}))).toBe("unknown");
  });
});

describe("checkRateLimit", () => {
  beforeEach(() => jest.clearAllMocks());

  it("issues the UPSERT against the api_rate_limit table with the window in seconds", async () => {
    mockPool.query.mockResolvedValue({
      rows: [{ contador: 1, ventana_inicio: new Date().toISOString() }],
    });
    await checkRateLimit("usuarios:GET:1.2.3.4", 60, 60_000);

    const [sql, params] = mockPool.query.mock.calls[0];
    expect(sql as string).toContain("INSERT INTO api_rate_limit");
    expect(sql as string).toContain("ON CONFLICT (clave)");
    expect(params).toEqual(["usuarios:GET:1.2.3.4", 60]);
  });

  it("is not limited while the counter is inside the max", async () => {
    mockPool.query.mockResolvedValue({
      rows: [{ contador: 59, ventana_inicio: new Date().toISOString() }],
    });
    const r = await checkRateLimit("clave", 60, 60_000);
    expect(r.limited).toBe(false);
    expect(r.restantes).toBe(1);
  });

  it("is limited once the counter exceeds the max and reports no remaining requests", async () => {
    mockPool.query.mockResolvedValue({
      rows: [{ contador: 61, ventana_inicio: new Date().toISOString() }],
    });
    const r = await checkRateLimit("clave", 60, 60_000);
    expect(r.limited).toBe(true);
    expect(r.restantes).toBe(0);
  });

  it("resets the counter when the fixed window has elapsed", async () => {
    const haceUnMinuto = new Date(Date.now() - 60_000).toISOString();
    mockPool.query.mockResolvedValue({
      rows: [{ contador: 1, ventana_inicio: haceUnMinuto }],
    });
    const r = await checkRateLimit("clave", 60, 60_000);
    expect(r.limited).toBe(false);
  });

  it("computes retryAfterSeconds from the elapsed time in the window", async () => {
    // Empezó la ventana hace 30 s de una ventana de 60 s → restan ~30 s.
    const haceTresSegundos = new Date(Date.now() - 30_000).toISOString();
    mockPool.query.mockResolvedValue({
      rows: [{ contador: 61, ventana_inicio: haceTresSegundos }],
    });
    const r = await checkRateLimit("clave", 60, 60_000);
    expect(r.limited).toBe(true);
    expect(r.retryAfterSeconds).toBeGreaterThanOrEqual(29);
    expect(r.retryAfterSeconds).toBeLessThanOrEqual(31);
  });
});