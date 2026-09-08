import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { rest } from "msw";
import { setupServer } from "msw/node";

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(),
}));

import { useRouter, usePathname } from "next/navigation";
import FacturacionPage from "@/app/facturacion/page";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => { server.resetHandlers(); jest.clearAllMocks(); });
afterAll(() => server.close());

const mockReplace = jest.fn();
const mockUsuarioEmpleado = { id_usuario: 2, nombre: "María", correo: "maria@tienda.com", tipo_usuario: "EMPLEADO" };

function ventaBase(overrides: Record<string, unknown> = {}) {
  return {
    id_venta: 1,
    fecha_venta: "2026-07-01T10:00:00.000Z",
    total: 100,
    estado_venta: "CONFIRMADO",
    nombre: "Carlos Ruiz",
    correo: "carlos@email.com",
    id_factura: 1,
    numero_factura: "FACT-000001",
    total_factura: 100,
    ...overrides,
  } as Record<string, unknown>;
}

function setupServerVentas(ventas: unknown[]) {
  server.use(
    rest.get("/api/sesion", (_req, res, ctx) => res(ctx.json({ usuario: mockUsuarioEmpleado }))),
    rest.get("/api/facturacion", (_req, res, ctx) => res(ctx.json({ ventas })))
  );
}

describe("FacturacionPage", () => {
  beforeEach(() => {
    (useRouter as jest.Mock).mockReturnValue({ replace: mockReplace });
    (usePathname as jest.Mock).mockReturnValue("/facturacion");
  });

  it("renders the ventas rows", async () => {
    setupServerVentas([
      ventaBase(),
      ventaBase({
        id_venta: 2,
        nombre: "Pedro Díaz",
        correo: "pedro@email.com",
        estado_venta: "PENDIENTE",
        id_factura: null,
        numero_factura: null,
        total_factura: null,
      }),
    ]);
    render(<FacturacionPage />);

    expect(await screen.findByText("Carlos Ruiz")).toBeInTheDocument();
    expect(screen.getByText("Pedro Díaz")).toBeInTheDocument();
    expect(screen.getByText("FACT-000001")).toBeInTheDocument();
    // "PENDIENTE" aparece como badge de la fila y como opción del filtro.
    expect(screen.getAllByText("PENDIENTE").length).toBeGreaterThanOrEqual(1);
  });

  it("filters rows by search query on client name or invoice number", async () => {
    setupServerVentas([
      ventaBase(),
      ventaBase({
        id_venta: 2,
        nombre: "Pedro Díaz",
        correo: "pedro@email.com",
        estado_venta: "CONFIRMADO",
        id_factura: null,
        numero_factura: null,
        total_factura: null,
      }),
    ]);
    const user = userEvent.setup();
    render(<FacturacionPage />);

    await screen.findByText("Carlos Ruiz");

    await user.type(screen.getByLabelText("Buscar en facturación"), "pedro");
    expect(screen.queryByText("Carlos Ruiz")).not.toBeInTheDocument();
    expect(screen.getByText("Pedro Díaz")).toBeInTheDocument();

    await user.clear(screen.getByLabelText("Buscar en facturación"));
    await user.type(screen.getByLabelText("Buscar en facturación"), "FACT-000001");
    expect(screen.getByText("Carlos Ruiz")).toBeInTheDocument();
    expect(screen.queryByText("Pedro Díaz")).not.toBeInTheDocument();
  });

  it("filters rows by estado_venta", async () => {
    setupServerVentas([
      ventaBase(),
      ventaBase({
        id_venta: 2,
        nombre: "Pedro Díaz",
        correo: "pedro@email.com",
        estado_venta: "PENDIENTE",
        id_factura: null,
        numero_factura: null,
        total_factura: null,
      }),
    ]);
    const user = userEvent.setup();
    render(<FacturacionPage />);

    await screen.findByText("Carlos Ruiz");

    await user.selectOptions(screen.getByLabelText("Filtrar por estado"), "PENDIENTE");
    expect(screen.queryByText("Carlos Ruiz")).not.toBeInTheDocument();
    expect(screen.getByText("Pedro Díaz")).toBeInTheDocument();

    // El select de estados se construye a partir de los valores de la data.
    const opciones = screen.getAllByRole("option");
    const etiquetas = opciones.map((o) => o.textContent);
    expect(etiquetas).toContain("CONFIRMADO");
    expect(etiquetas).toContain("PENDIENTE");
  });

  it("filters rows by facturación state (sin facturar / facturadas)", async () => {
    setupServerVentas([
      ventaBase(),
      ventaBase({
        id_venta: 2,
        nombre: "Pedro Díaz",
        correo: "pedro@email.com",
        estado_venta: "CONFIRMADO",
        id_factura: null,
        numero_factura: null,
        total_factura: null,
      }),
    ]);
    const user = userEvent.setup();
    render(<FacturacionPage />);

    await screen.findByText("Carlos Ruiz");

    await user.selectOptions(screen.getByLabelText("Filtrar por facturación"), "sin_facturar");
    expect(screen.queryByText("Carlos Ruiz")).not.toBeInTheDocument();
    expect(screen.getByText("Pedro Díaz")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Filtrar por facturación"), "facturadas");
    expect(screen.getByText("Carlos Ruiz")).toBeInTheDocument();
    expect(screen.queryByText("Pedro Díaz")).not.toBeInTheDocument();
  });

  it("shows an empty message when no results match the filters", async () => {
    setupServerVentas([ventaBase()]);
    const user = userEvent.setup();
    render(<FacturacionPage />);

    await screen.findByText("Carlos Ruiz");

    await user.type(screen.getByLabelText("Buscar en facturación"), "no-existe");
    expect(screen.getByText("Ningún resultado para esa búsqueda o filtro.")).toBeInTheDocument();
  });

  it("paginates the results and updates the page counter", async () => {
    const muchas = Array.from({ length: 15 }, (_, i) =>
      ventaBase({
        id_venta: i + 1,
        nombre: `Cliente ${i + 1}`,
        correo: `cliente${i + 1}@email.com`,
        estado_venta: "CONFIRMADO",
      })
    );
    setupServerVentas(muchas);
    const user = userEvent.setup();
    render(<FacturacionPage />);

    // Página 1: primeras 10, la 11 no está visible todavía.
    await screen.findByText("Cliente 1");
    expect(screen.getByText("Cliente 10")).toBeInTheDocument();
    expect(screen.queryByText("Cliente 11")).not.toBeInTheDocument();
    expect(screen.getByText("1 / 2")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Página siguiente" }));
    await waitFor(() => expect(screen.getByText("Cliente 11")).toBeInTheDocument());
    expect(screen.getByText("2 / 2")).toBeInTheDocument();
    expect(screen.queryByText("Cliente 10")).not.toBeInTheDocument();

    // Cambiar tamaño de página a 25 muestra todo en una página.
    await user.selectOptions(screen.getByLabelText("Resultados por página"), "25");
    await waitFor(() => expect(screen.getByText("Cliente 15")).toBeInTheDocument());
    expect(screen.getByText("1 / 1")).toBeInTheDocument();
  });

  // DEV-118: vista de detalle/impresión de una factura ya emitida.
  it("shows a 'Ver factura' button for already-invoiced sales, and opens the detail on click", async () => {
    setupServerVentas([ventaBase()]);
    server.use(
      rest.get("/api/facturacion/1", (_req, res, ctx) =>
        res(
          ctx.json({
            factura: {
              id_venta: 1,
              fecha_venta: "2026-07-01T10:00:00.000Z",
              total: 100,
              estado_venta: "CONFIRMADO",
              nombre: "Carlos Ruiz",
              correo: "carlos@email.com",
              id_factura: 1,
              numero_factura: "FACT-000001",
              nombre_cliente: "Carlos Ruiz",
              nit_cliente: "CF",
              total_factura: 100,
              productos: [
                {
                  id_detalle: 1,
                  codigo_producto: "P-01",
                  nombre_producto: "Arroz 5lb",
                  cantidad: 2,
                  precio_unitario: 25,
                  subtotal: 50,
                },
              ],
            },
          })
        )
      )
    );
    const user = userEvent.setup();
    render(<FacturacionPage />);

    await screen.findByText("Carlos Ruiz");
    // No debe haber botón "Emitir" para una venta ya facturada.
    expect(screen.queryByRole("button", { name: "Emitir" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Ver factura" }));

    expect(await screen.findByText("Factura FACT-000001")).toBeInTheDocument();
    expect(screen.getByText("Arroz 5lb")).toBeInTheDocument();
    expect(screen.getByText("Total: Q100.00")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(screen.queryByText("Factura FACT-000001")).not.toBeInTheDocument();
  });

  it("shows an error message if the invoice detail fails to load", async () => {
    setupServerVentas([ventaBase()]);
    server.use(
      rest.get("/api/facturacion/1", (_req, res, ctx) =>
        res(ctx.status(404), ctx.json({ error: "Venta no encontrada" }))
      )
    );
    const user = userEvent.setup();
    render(<FacturacionPage />);

    await screen.findByText("Carlos Ruiz");
    await user.click(screen.getByRole("button", { name: "Ver factura" }));

    expect(await screen.findByText("Venta no encontrada")).toBeInTheDocument();
  });
});