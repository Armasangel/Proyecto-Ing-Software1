import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { rest } from "msw";
import { setupServer } from "msw/node";

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(),
}));

import { useRouter, usePathname } from "next/navigation";
import { StaffShell } from "@/components/StaffShell";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => { server.resetHandlers(); jest.clearAllMocks(); });
afterAll(() => server.close());

const mockReplace = jest.fn();
const duenoUser = { id_usuario: 1, nombre: "Juan Pérez", correo: "juan@tienda.com", tipo_usuario: "DUENO" };
const empleadoUser = { id_usuario: 2, nombre: "María López", correo: "maria@tienda.com", tipo_usuario: "EMPLEADO" };

describe("StaffShell", () => {
  beforeEach(() => {
    (useRouter as jest.Mock).mockReturnValue({ replace: mockReplace });
    (usePathname as jest.Mock).mockReturnValue("/dashboard");
  });

  it("renders the logo, title, and children", () => {
    render(
      <StaffShell usuario={duenoUser} title="Dashboard">
        <p>Contenido</p>
      </StaffShell>
    );
    expect(screen.getByText("Tienda")).toBeInTheDocument();
    expect(screen.getByText("San Miguel")).toBeInTheDocument();
    expect(screen.getAllByText("Dashboard").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Contenido")).toBeInTheDocument();
  });

  it("renders subtitle when provided", () => {
    render(
      <StaffShell usuario={duenoUser} title="Dashboard" subtitle="Bienvenido">
        <p>Contenido</p>
      </StaffShell>
    );
    expect(screen.getByText("Bienvenido")).toBeInTheDocument();
  });

  it("shows dueno-only nav items for DUENO user", () => {
    render(
      <StaffShell usuario={duenoUser} title="Dashboard">
        <p>Contenido</p>
      </StaffShell>
    );
    expect(screen.getByText("Inventario")).toBeInTheDocument();
    expect(screen.getByText("Catálogo")).toBeInTheDocument();
    expect(screen.getByText("Proveedores")).toBeInTheDocument();
    expect(screen.getByText("Historial ventas")).toBeInTheDocument();
    expect(screen.getByText("Deudas")).toBeInTheDocument();
    expect(screen.getAllByText("Dashboard").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Facturación")).toBeInTheDocument();
    expect(screen.getByText("Reportes")).toBeInTheDocument();
  });

  it("hides Ventas for DUENO user", () => {
    render(
      <StaffShell usuario={duenoUser} title="Dashboard">
        <p>Contenido</p>
      </StaffShell>
    );
    expect(screen.queryByText("Ventas")).not.toBeInTheDocument();
  });

  it("shows Ventas for EMPLEADO user and hides dueno-only items", () => {
    render(
      <StaffShell usuario={empleadoUser} title="Ventas">
        <p>Contenido</p>
      </StaffShell>
    );
    expect(screen.getAllByText("Ventas").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("Inventario")).not.toBeInTheDocument();
    expect(screen.queryByText("Catálogo")).not.toBeInTheDocument();
    expect(screen.queryByText("Proveedores")).not.toBeInTheDocument();
    expect(screen.queryByText("Historial ventas")).not.toBeInTheDocument();
    expect(screen.queryByText("Deudas")).not.toBeInTheDocument();
  });

  it("shows the role badge for dueno", () => {
    render(
      <StaffShell usuario={duenoUser} title="Dashboard">
        <p>Contenido</p>
      </StaffShell>
    );
    expect(screen.getByText("Panel del dueño")).toBeInTheDocument();
  });

  it("shows the role badge for colaborador", () => {
    render(
      <StaffShell usuario={empleadoUser} title="Ventas">
        <p>Contenido</p>
      </StaffShell>
    );
    expect(screen.getAllByText("Colaborador").length).toBeGreaterThanOrEqual(1);
  });

  it("shows user name and role in sidebar", () => {
    render(
      <StaffShell usuario={duenoUser} title="Dashboard">
        <p>Contenido</p>
      </StaffShell>
    );
    expect(screen.getByText("Juan")).toBeInTheDocument();
    expect(screen.getByText("Dueño")).toBeInTheDocument();
  });

  it("shows logout button", () => {
    render(
      <StaffShell usuario={duenoUser} title="Dashboard">
        <p>Contenido</p>
      </StaffShell>
    );
    expect(screen.getByText("Cerrar sesión")).toBeInTheDocument();
  });

  it("calls /api/logout and redirects on logout click", async () => {
    let logoutCalled = false;
    server.use(
      rest.post("/api/logout", (_req, res, ctx) => {
        logoutCalled = true;
        return res(ctx.json({ ok: true }));
      })
    );
    const user = userEvent.setup();
    render(
      <StaffShell usuario={duenoUser} title="Dashboard">
        <p>Contenido</p>
      </StaffShell>
    );
    await user.click(screen.getByText("Cerrar sesión"));
    await waitFor(() => expect(logoutCalled).toBe(true));
    expect(mockReplace).toHaveBeenCalledWith("/login");
  });
});
