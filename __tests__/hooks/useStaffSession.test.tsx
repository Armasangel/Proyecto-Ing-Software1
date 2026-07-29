import { renderHook, waitFor } from "@testing-library/react";
import { rest } from "msw";
import { setupServer } from "msw/node";

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
}));

import { useRouter } from "next/navigation";
import { useStaffSession } from "@/hooks/useStaffSession";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => { server.resetHandlers(); jest.clearAllMocks(); });
afterAll(() => server.close());

const mockReplace = jest.fn();
const mockUserDueno = { id_usuario: 1, nombre: "Juan", correo: "juan@test.com", tipo_usuario: "DUENO" };
const mockUserEmpleado = { id_usuario: 2, nombre: "María", correo: "maria@test.com", tipo_usuario: "EMPLEADO" };

describe("useStaffSession", () => {
  beforeEach(() => {
    (useRouter as jest.Mock).mockReturnValue({ replace: mockReplace });
  });

  it("returns null initially", () => {
    const { result } = renderHook(() => useStaffSession());
    expect(result.current).toBeNull();
  });

  it("returns usuario when authenticated as DUENO", async () => {
    server.use(
      rest.get("/api/sesion", (_req, res, ctx) =>
        res(ctx.json({ usuario: mockUserDueno }))
      )
    );
    const { result } = renderHook(() => useStaffSession());
    await waitFor(() => expect(result.current).not.toBeNull());
    expect(result.current).toMatchObject({ tipo_usuario: "DUENO" });
  });

  it("returns usuario when authenticated as EMPLEADO", async () => {
    server.use(
      rest.get("/api/sesion", (_req, res, ctx) =>
        res(ctx.json({ usuario: mockUserEmpleado }))
      )
    );
    const { result } = renderHook(() => useStaffSession());
    await waitFor(() => expect(result.current).not.toBeNull());
    expect(result.current).toMatchObject({ tipo_usuario: "EMPLEADO" });
  });

  it("redirects to /login when no usuario returned", async () => {
    server.use(
      rest.get("/api/sesion", (_req, res, ctx) =>
        res(ctx.json({ usuario: null }))
      )
    );
    renderHook(() => useStaffSession());
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/login"));
  });

  it("redirects to postLoginPath for non-staff role", async () => {
    server.use(
      rest.get("/api/sesion", (_req, res, ctx) =>
        res(ctx.json({ usuario: { ...mockUserDueno, tipo_usuario: "CLIENTE" } }))
      )
    );
    renderHook(() => useStaffSession());
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/dashboard"));
  });
});
