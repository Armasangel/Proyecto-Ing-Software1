import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { rest } from "msw";
import { setupServer } from "msw/node";

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(),
}));

import { useRouter, usePathname } from "next/navigation";
import ProveedoresPage from "@/app/proveedores/page";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => { server.resetHandlers(); jest.clearAllMocks(); });
afterAll(() => server.close());

const mockReplace = jest.fn();
const mockUsuarioDueno = { id_usuario: 1, nombre: "Juan Pérez", correo: "juan@tienda.com", tipo_usuario: "DUENO" };

function proveedorBase(overrides: Record<string, unknown> = {}) {
  return {
    id_proveedor: 1,
    nombre_proveedor: "Distribuidora La Colonia",
    nit_proveedor: "12345678-9",
    correo_contacto: "ventas@colonia.com",
    telefono: "5555-1234",
    estado_proveedor: true,
    ...overrides,
  } as Record<string, unknown>;
}

function setupServerProveedores(proveedores: unknown[]) {
  server.use(
    rest.get("/api/sesion", (_req, res, ctx) => res(ctx.json({ usuario: mockUsuarioDueno }))),
    rest.get("/api/proveedores", (_req, res, ctx) => res(ctx.json({ proveedores })))
  );
}

describe("ProveedoresPage", () => {
  beforeEach(() => {
    (useRouter as jest.Mock).mockReturnValue({ replace: mockReplace });
    (usePathname as jest.Mock).mockReturnValue("/proveedores");
  });

  it("renders the proveedores rows", async () => {
    setupServerProveedores([
      proveedorBase(),
      proveedorBase({
        id_proveedor: 2,
        nombre_proveedor: "Agroinsumos Central",
        nit_proveedor: "98765432-1",
        correo_contacto: null,
        telefono: null,
        estado_proveedor: false,
      }),
    ]);
    render(<ProveedoresPage />);

    expect(await screen.findByText("Distribuidora La Colonia")).toBeInTheDocument();
    expect(screen.getByText("Agroinsumos Central")).toBeInTheDocument();
    expect(screen.getByText("12345678-9")).toBeInTheDocument();
    // "Activo"/"Inactivo" aparecen como el estado de cada fila y como opciones del filtro.
    expect(screen.getAllByText("Activo").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Inactivo").length).toBeGreaterThanOrEqual(1);
  });

  it("filters rows by search query on name or NIT", async () => {
    setupServerProveedores([proveedorBase(), proveedorBase({
      id_proveedor: 2,
      nombre_proveedor: "Agroinsumos Central",
      nit_proveedor: "98765432-1",
      correo_contacto: null,
      telefono: null,
      estado_proveedor: true,
    })]);
    const user = userEvent.setup();
    render(<ProveedoresPage />);

    await screen.findByText("Distribuidora La Colonia");

    await user.type(screen.getByLabelText("Buscar en proveedores"), "agroinsumos");
    expect(screen.queryByText("Distribuidora La Colonia")).not.toBeInTheDocument();
    expect(screen.getByText("Agroinsumos Central")).toBeInTheDocument();

    await user.clear(screen.getByLabelText("Buscar en proveedores"));
    await user.type(screen.getByLabelText("Buscar en proveedores"), "98765432-1");
    expect(screen.getByText("Agroinsumos Central")).toBeInTheDocument();
    expect(screen.queryByText("Distribuidora La Colonia")).not.toBeInTheDocument();
  });

  it("filters rows by estado_proveedor", async () => {
    setupServerProveedores([
      proveedorBase(),
      proveedorBase({
        id_proveedor: 2,
        nombre_proveedor: "Agroinsumos Central",
        nit_proveedor: "98765432-1",
        correo_contacto: null,
        telefono: null,
        estado_proveedor: false,
      }),
    ]);
    const user = userEvent.setup();
    render(<ProveedoresPage />);

    await screen.findByText("Distribuidora La Colonia");

    await user.selectOptions(screen.getByLabelText("Filtrar por estado"), "false");
    expect(screen.queryByText("Distribuidora La Colonia")).not.toBeInTheDocument();
    expect(screen.getByText("Agroinsumos Central")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Filtrar por estado"), "true");
    expect(screen.getByText("Distribuidora La Colonia")).toBeInTheDocument();
    expect(screen.queryByText("Agroinsumos Central")).not.toBeInTheDocument();

    // El select de estados se construye a partir de los valores de la data.
    const opciones = screen.getAllByRole("option");
    const etiquetas = opciones.map((o) => o.textContent);
    expect(etiquetas).toContain("Activos");
    expect(etiquetas).toContain("Inactivos");
  });

  it("shows an empty message when no results match the filters", async () => {
    setupServerProveedores([proveedorBase()]);
    const user = userEvent.setup();
    render(<ProveedoresPage />);

    await screen.findByText("Distribuidora La Colonia");

    await user.type(screen.getByLabelText("Buscar en proveedores"), "no-existe");
    expect(screen.getByText("Ningún resultado para esa búsqueda o filtro.")).toBeInTheDocument();
  });

  it("paginates the results and updates the page counter", async () => {
    const muchos = Array.from({ length: 15 }, (_, i) =>
      proveedorBase({
        id_proveedor: i + 1,
        nombre_proveedor: `Proveedor ${i + 1}`,
        nit_proveedor: `NIT-${i + 1}`,
        correo_contacto: null,
        telefono: null,
        estado_proveedor: true,
      })
    );
    setupServerProveedores(muchos);
    const user = userEvent.setup();
    render(<ProveedoresPage />);

    // Página 1: primeras 10, la 11 no está visible todavía.
    await screen.findByText("Proveedor 1");
    expect(screen.getByText("Proveedor 10")).toBeInTheDocument();
    expect(screen.queryByText("Proveedor 11")).not.toBeInTheDocument();
    expect(screen.getByText("1 / 2")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Página siguiente" }));
    await waitFor(() => expect(screen.getByText("Proveedor 11")).toBeInTheDocument());
    expect(screen.getByText("2 / 2")).toBeInTheDocument();
    expect(screen.queryByText("Proveedor 10")).not.toBeInTheDocument();

    // Cambiar tamaño de página a 25 muestra todo en una página.
    await user.selectOptions(screen.getByLabelText("Resultados por página"), "25");
    await waitFor(() => expect(screen.getByText("Proveedor 15")).toBeInTheDocument());
    expect(screen.getByText("1 / 1")).toBeInTheDocument();
  });
});