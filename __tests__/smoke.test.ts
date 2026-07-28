import { setupServer } from "msw/node";
import { rest } from "msw";

const server = setupServer(
  rest.get("/api/test", (_req, res, ctx) => {
    return res(ctx.json({ ok: true }));
  })
);

beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("Setup verification", () => {
  it("jest-dom matchers work", () => {
    const div = document.createElement("div");
    div.textContent = "hello";
    document.body.appendChild(div);
    expect(div).toHaveTextContent("hello");
  });

  it("MSW server works", async () => {
    const res = await fetch("/api/test");
    const data = await res.json();
    expect(data).toEqual({ ok: true });
  });

  it("path alias @/ works", async () => {
    const { isStaffTipo } = await import("@/lib/roles");
    expect(isStaffTipo("DUENO")).toBe(true);
  });
});
