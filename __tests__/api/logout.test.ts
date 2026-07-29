import { POST } from "@/app/api/logout/route";
import { createMockRequest } from "@/__tests__/utils/api-test-utils";

describe("POST /api/logout", () => {
  it("returns { ok: true }", async () => {
    const req = createMockRequest("/api/logout", { method: "POST" });
    const res = await POST(req);
    const data = await res.json();
    expect(data).toEqual({ ok: true });
  });

  it("clears the auth_token cookie", async () => {
    const req = createMockRequest("/api/logout", { method: "POST" });
    const res = await POST(req);
    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toContain("auth_token=");
    expect(setCookie).toContain("Max-Age=0");
  });
});
