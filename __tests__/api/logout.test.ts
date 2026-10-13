import { POST } from "@/app/api/logout/route";
import { createMockRequest } from "../utils/api-test-utils";

jest.mock("@/lib/db", () => ({
  pool: { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) },
}));

describe("POST /api/logout", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns { ok: true }", async () => {
    const res = await POST(createMockRequest("/api/logout", { method: "POST" }));
    const data = await res.json();
    expect(data).toEqual({ ok: true });
  });

  it("clears the auth_token cookie", async () => {
    const res = await POST(createMockRequest("/api/logout", { method: "POST" }));
    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toContain("auth_token=");
    expect(setCookie).toContain("Max-Age=0");
  });
});