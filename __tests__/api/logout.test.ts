import { POST } from "@/app/api/logout/route";

describe("POST /api/logout", () => {
  it("returns { ok: true }", async () => {
    const res = await POST();
    const data = await res.json();
    expect(data).toEqual({ ok: true });
  });

  it("clears the auth_token cookie", async () => {
    const res = await POST();
    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toContain("auth_token=");
    expect(setCookie).toContain("Max-Age=0");
  });
});
