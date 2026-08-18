import { NextRequest } from "next/server";
import {
  clearFailedLogins,
  getClientIp,
  isLoginRateLimited,
  LOGIN_RATE_LIMIT_MAX,
  recordFailedLogin,
  resetLoginRateLimitStore,
} from "@/lib/login-rate-limit";

jest.mock("@/lib/db", () => ({
  pool: { query: jest.fn() },
}));

const mockPool = jest.requireMock("@/lib/db").pool as { query: jest.Mock };

function requestWithHeaders(headers: Record<string, string>): NextRequest {
  return new NextRequest(new URL("http://localhost/api/login"), { headers });
}

describe("login-rate-limit", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("reads IP from x-forwarded-for (first hop)", () => {
    const req = requestWithHeaders({
      "x-forwarded-for": "203.0.113.10, 10.0.0.1",
    });
    expect(getClientIp(req)).toBe("203.0.113.10");
  });

  it("falls back to x-real-ip then unknown", () => {
    expect(getClientIp(requestWithHeaders({ "x-real-ip": "198.51.100.1" }))).toBe(
      "198.51.100.1"
    );
    expect(getClientIp(requestWithHeaders({}))).toBe("unknown");
  });

  it("is not limited when there is no row for the IP", async () => {
    mockPool.query.mockResolvedValue({ rows: [] });
    await expect(isLoginRateLimited("203.0.113.50")).resolves.toBe(false);
    expect(mockPool.query).toHaveBeenCalledWith(
      expect.stringContaining("SELECT bloqueado_hasta FROM login_intento"),
      ["203.0.113.50"]
    );
  });

  it("is limited while bloqueado_hasta is in the future", async () => {
    mockPool.query.mockResolvedValue({
      rows: [{ bloqueado_hasta: new Date(Date.now() + 30_000) }],
    });
    await expect(isLoginRateLimited("203.0.113.50")).resolves.toBe(true);
  });

  it("is not limited when the block has expired", async () => {
    mockPool.query.mockResolvedValue({
      rows: [{ bloqueado_hasta: new Date(Date.now() - 5_000) }],
    });
    await expect(isLoginRateLimited("203.0.113.50")).resolves.toBe(false);
  });

  it("records failures and blocks after MAX attempts", async () => {
    let intentos = 0;
    mockPool.query.mockImplementation(async (sql: string) => {
      if (sql.includes("INSERT INTO login_intento")) {
        intentos += 1;
        return { rows: [{ intentos }] };
      }
      return { rows: [] };
    });

    for (let i = 0; i < LOGIN_RATE_LIMIT_MAX; i++) {
      await recordFailedLogin("203.0.113.50");
    }

    expect(mockPool.query).toHaveBeenCalledTimes(LOGIN_RATE_LIMIT_MAX + 1);
    const blockCall = mockPool.query.mock.calls[LOGIN_RATE_LIMIT_MAX];
    expect(blockCall[0]).toContain("UPDATE login_intento");
    expect(blockCall[1]).toEqual(["203.0.113.50", expect.any(Number)]);
  });

  it("clears failures for an IP", async () => {
    mockPool.query.mockResolvedValue({ rows: [] });
    await clearFailedLogins("203.0.113.60");
    expect(mockPool.query).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM login_intento"),
      ["203.0.113.60"]
    );
  });

  it("resetLoginRateLimitStore truncates the table", async () => {
    mockPool.query.mockResolvedValue({ rows: [] });
    await resetLoginRateLimitStore();
    expect(mockPool.query).toHaveBeenCalledWith(
      expect.stringContaining("TRUNCATE TABLE login_intento")
    );
  });
});
