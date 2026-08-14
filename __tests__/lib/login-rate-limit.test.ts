import { NextRequest } from "next/server";
import {
  clearFailedLogins,
  getClientIp,
  isLoginRateLimited,
  LOGIN_RATE_LIMIT_MAX,
  recordFailedLogin,
  resetLoginRateLimitStore,
} from "@/lib/login-rate-limit";

function requestWithHeaders(headers: Record<string, string>): NextRequest {
  return new NextRequest(new URL("http://localhost/api/login"), { headers });
}

describe("login-rate-limit", () => {
  beforeEach(() => {
    resetLoginRateLimitStore();
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

  it("rate-limits after max failures in the window", () => {
    const ip = "203.0.113.50";
    expect(isLoginRateLimited(ip)).toBe(false);

    for (let i = 0; i < LOGIN_RATE_LIMIT_MAX; i++) {
      recordFailedLogin(ip);
    }

    expect(isLoginRateLimited(ip)).toBe(true);
  });

  it("clears failures for an IP", () => {
    const ip = "203.0.113.60";
    for (let i = 0; i < LOGIN_RATE_LIMIT_MAX; i++) {
      recordFailedLogin(ip);
    }
    clearFailedLogins(ip);
    expect(isLoginRateLimited(ip)).toBe(false);
  });
});
