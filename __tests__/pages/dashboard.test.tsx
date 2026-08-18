import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { rest } from "msw";
import { setupServer } from "msw/node";

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(),
}));

import { useRouter, usePathname } from "next/navigation";
import DashboardPage from "@/app/dashboard/page";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => { server.resetHandlers(); jest.clearAllMocks(); });
afterAll(() => server.close());

const mockReplace = jest.fn();
const mockUsuario = { id_usuario: 1, nombre: "Juan Pérez", correo: "juan@tienda.com", tipo_usuario: "DUENO" };
const mockStats = { productos: 10, ventas: 25, pendientes: 3, proveedores: 5 };

describe("DashboardPage", () => {
  beforeEach(() => {
    (useRouter as jest.Mock).mockReturnValue({ replace: mockReplace });
    (usePathname as jest.Mock).mockReturnValue("/dashboard");
  });

  it("shows loading state before session resolves", () => {
    server.use(
      rest.get("/api/sesion", () => new Promise<void>(() => {}))
    );
    render(<DashboardPage />);
    expect(screen.getByText("Cargando…")).toBeInTheDocument();
  });

  it("renders the StaffShell and stat cards when authenticated", async () => {
    server.use(
      rest.get("/api/sesion", (_req, res, ctx) =>
        res(ctx.json({ usuario: mockUsuario }))
      ),
      rest.get("/api/stats", (_req, res, ctx) =>
        res(ctx.json({ stats: mockStats }))
      )
    );
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getAllByText("Dashboard").length).toBeGreaterThanOrEqual(1);
    });

    await waitFor(() => {
      expect(screen.getByText("10")).toBeInTheDocument();
      expect(screen.getByText("25")).toBeInTheDocument();
      expect(screen.getByText("3")).toBeInTheDocument();
      expect(screen.getByText("5")).toBeInTheDocument();
    });

    expect(screen.getByText("Productos activos")).toBeInTheDocument();
    expect(screen.getByText("Ventas registradas")).toBeInTheDocument();
    expect(screen.getByText("Ventas pendientes")).toBeInTheDocument();
    expect(screen.getAllByText("Proveedores").length).toBeGreaterThanOrEqual(1);
  });

  it("shows the greeting with the user's first name", async () => {
    server.use(
      rest.get("/api/sesion", (_req, res, ctx) =>
        res(ctx.json({ usuario: mockUsuario }))
      ),
      rest.get("/api/stats", (_req, res, ctx) =>
        res(ctx.json({ stats: mockStats }))
      )
    );
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText(/Hola, Juan/)).toBeInTheDocument();
    });
  });

  it("shows the alert card when there are pending sales", async () => {
    server.use(
      rest.get("/api/sesion", (_req, res, ctx) =>
        res(ctx.json({ usuario: mockUsuario }))
      ),
      rest.get("/api/stats", (_req, res, ctx) =>
        res(ctx.json({ stats: { ...mockStats, pendientes: 3 } }))
      )
    );
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText("3 ventas pendientes")).toBeInTheDocument();
    });
    expect(screen.getByText("Ver detalles →")).toBeInTheDocument();
  });

  it("does not show alert when no pending sales", async () => {
    server.use(
      rest.get("/api/sesion", (_req, res, ctx) =>
        res(ctx.json({ usuario: mockUsuario }))
      ),
      rest.get("/api/stats", (_req, res, ctx) =>
        res(ctx.json({ stats: { ...mockStats, pendientes: 0 } }))
      )
    );
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getAllByText("Dashboard").length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.queryByText("Ver detalles →")).not.toBeInTheDocument();
  });

  it("shows an error card instead of silent zeros when stats return 500", async () => {
    server.use(
      rest.get("/api/sesion", (_req, res, ctx) =>
        res(ctx.json({ usuario: mockUsuario }))
      ),
      rest.get("/api/stats", (_req, res, ctx) =>
        res(ctx.status(500), ctx.json({ error: "Error interno del servidor" }))
      )
    );
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText("No se pudieron cargar las estadísticas")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
    expect(
      screen.getByText(/También puedes recargar la página/)
    ).toBeInTheDocument();
    expect(screen.queryByText("Productos activos")).not.toBeInTheDocument();
    expect(screen.queryByText("Ventas registradas")).not.toBeInTheDocument();
    expect(screen.queryByText("Ventas pendientes")).not.toBeInTheDocument();
    expect(screen.queryByText("Sistema activo")).not.toBeInTheDocument();
  });

  it("reloads stats after clicking Reintentar on a previous 500", async () => {
    let fail = true;
    server.use(
      rest.get("/api/sesion", (_req, res, ctx) =>
        res(ctx.json({ usuario: mockUsuario }))
      ),
      rest.get("/api/stats", (_req, res, ctx) => {
        if (fail) {
          return res(ctx.status(500), ctx.json({ error: "Error interno del servidor" }));
        }
        return res(ctx.json({ stats: mockStats }));
      })
    );
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText("No se pudieron cargar las estadísticas")).toBeInTheDocument();
    });

    fail = false;
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    await waitFor(() => {
      expect(screen.getByText("10")).toBeInTheDocument();
      expect(screen.getByText("Productos activos")).toBeInTheDocument();
    });
    expect(screen.queryByText("No se pudieron cargar las estadísticas")).not.toBeInTheDocument();
    expect(screen.getByText("Sistema activo")).toBeInTheDocument();
  });
});
