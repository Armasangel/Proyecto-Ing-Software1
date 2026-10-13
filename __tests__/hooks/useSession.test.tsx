import { renderHook, waitFor } from "@testing-library/react";
import { rest } from "msw";
import { setupServer } from "msw/node";

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
}));

import { useRouter } from "next/navigation";
import { useSession } from "@/hooks/useSession";
import { ROLES_BODEGUERO, ROLES_DUENO, ROLES_STAFF } from "@/lib/roles";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => { server.resetHandlers(); jest.clearAllMocks(); });
afterAll(() => server.close());

const mockReplace = jest.fn();
const mockUserDueno = { id_usuario: 1, nombre: "Juan", correo: "juan@test.com", tipo_usuario: "DUENO" };
const mockUserEmpleado = { id_usuario: 2, nombre: "María", correo: "maria@test.com", tipo_usuario: "EMPLEADO" };
const mockUserBodeguero = { id_usuario: 3, nombre: "Luis", correo: "luis@test.com", tipo_usuario: "BODEGUERO", id_bodega: 7 };

function sesion(usuario: unknown) {
  server.use(rest.get("/api/sesion", (_req, res, ctx) => res(ctx.json({ usuario }))));
}

describe("useSession", () => {
  beforeEach(() => {
    (useRouter as jest.Mock).mockReturnValue({ replace: mockReplace });
  });

  it("returns null initially", () => {
    const { result } = renderHook(() => useSession({ roles: ROLES_STAFF }));
    expect(result.current).toBeNull();
  });

  it("redirects to /login when there is no usuario (any roles)", async () => {
    sesion(null);
    renderHook(() => useSession({ roles: ROLES_DUENO }));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/login"));
  });

  describe("roles: ROLES_STAFF (dueño o colaborador)", () => {
    it("returns usuario when authenticated as DUENO", async () => {
      sesion(mockUserDueno);
      const { result } = renderHook(() => useSession({ roles: ROLES_STAFF }));
      await waitFor(() => expect(result.current).not.toBeNull());
      expect(result.current).toMatchObject({ tipo_usuario: "DUENO" });
    });

    it("returns usuario when authenticated as EMPLEADO", async () => {
      sesion(mockUserEmpleado);
      const { result } = renderHook(() => useSession({ roles: ROLES_STAFF }));
      await waitFor(() => expect(result.current).not.toBeNull());
      expect(result.current).toMatchObject({ tipo_usuario: "EMPLEADO" });
    });

    it("redirects to postLoginPath for a non-staff role", async () => {
      sesion({ ...mockUserDueno, tipo_usuario: "CLIENTE" });
      renderHook(() => useSession({ roles: ROLES_STAFF }));
      await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/dashboard"));
    });

    it("sends a BODEGUERO to its own panel", async () => {
      sesion(mockUserBodeguero);
      const { result } = renderHook(() => useSession({ roles: ROLES_STAFF }));
      await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/bodega"));
      expect(result.current).toBeNull();
    });
  });

  describe("roles: ROLES_DUENO", () => {
    it("returns usuario when authenticated as DUENO", async () => {
      sesion(mockUserDueno);
      const { result } = renderHook(() => useSession({ roles: ROLES_DUENO }));
      await waitFor(() => expect(result.current).not.toBeNull());
      expect(result.current).toMatchObject({ tipo_usuario: "DUENO" });
    });

    it("redirects to postLoginPath for EMPLEADO (non-dueno)", async () => {
      sesion(mockUserEmpleado);
      renderHook(() => useSession({ roles: ROLES_DUENO }));
      await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/ventas"));
    });

    it("keeps returning null for non-dueno (no state update)", async () => {
      sesion(mockUserEmpleado);
      const { result } = renderHook(() => useSession({ roles: ROLES_DUENO }));
      await waitFor(() => expect(mockReplace).toHaveBeenCalled());
      expect(result.current).toBeNull();
    });
  });

  describe("roles: ROLES_BODEGUERO", () => {
    it("returns the bodeguero with its id_bodega", async () => {
      sesion(mockUserBodeguero);
      const { result } = renderHook(() => useSession({ roles: ROLES_BODEGUERO }));
      await waitFor(() => expect(result.current).not.toBeNull());
      // `id_bodega` está tipado porque los roles piden BODEGUERO
      expect(result.current?.id_bodega).toBe(7);
      expect(mockReplace).not.toHaveBeenCalled();
    });

    it("redirects a bodeguero without an assigned bodega", async () => {
      sesion({ ...mockUserBodeguero, id_bodega: null });
      const { result } = renderHook(() => useSession({ roles: ROLES_BODEGUERO }));
      await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/bodega"));
      expect(result.current).toBeNull();
    });

    it("redirects dueño/colaborador to their own view", async () => {
      sesion(mockUserDueno);
      renderHook(() => useSession({ roles: ROLES_BODEGUERO }));
      await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/dashboard"));
    });
  });

  describe("roles combinados o inline", () => {
    it("accepts several roles, including a bodeguero, in one call", async () => {
      sesion(mockUserBodeguero);
      const { result } = renderHook(() => useSession({ roles: ["DUENO", "BODEGUERO"] }));
      await waitFor(() => expect(result.current).not.toBeNull());
      expect(result.current).toMatchObject({ tipo_usuario: "BODEGUERO" });
    });

    it("does not refetch the session when the roles array is recreated on each render", async () => {
      let llamadas = 0;
      server.use(
        rest.get("/api/sesion", (_req, res, ctx) => {
          llamadas += 1;
          return res(ctx.json({ usuario: mockUserDueno }));
        })
      );
      const { result, rerender } = renderHook(() => useSession({ roles: ["DUENO", "EMPLEADO"] }));
      await waitFor(() => expect(result.current).not.toBeNull());
      rerender();
      rerender();
      await new Promise((r) => setTimeout(r, 30));
      expect(llamadas).toBe(1);
    });

    it("does not redirect or update state after unmounting", async () => {
      server.use(
        rest.get("/api/sesion", (_req, res, ctx) => res(ctx.delay(40), ctx.json({ usuario: null })))
      );
      const { unmount } = renderHook(() => useSession({ roles: ROLES_STAFF }));
      unmount();
      await new Promise((r) => setTimeout(r, 100));
      expect(mockReplace).not.toHaveBeenCalled();
    });
  });
});
