import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { rest } from "msw";
import { setupServer } from "msw/node";

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(),
}));

import { useRouter, usePathname } from "next/navigation";
import InventarioPage from "@/app/inventario/page";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => { server.resetHandlers(); jest.clearAllMocks(); });
afterAll(() => server.close());

const mockReplace = jest.fn();
const mockUsuarioDueno = { id_usuario: 1, nombre: "Juan Pérez", correo: "juan@tienda.com", tipo_usuario: "DUENO" };

const producto = {
  id_producto: 1,
  codigo_producto: "ARR-001",
  nombre_producto: "Arroz 1 libra",
  nombre_categoria: "Granos",
  id_categoria: 1,
  nombre_marca: "Diana",
  id_marca: 1,
  precio_unitario: "4.50",
  precio_mayoreo: "4.00",
  unidad_medida: "libra",
  estado_producto: true,
  caducidad: false,
  exento_iva: false,
};

const stockRow = {
  id_bodega: 1,
  nombre_bodega: "Bodega Principal",
  ubicacion: "Zona 1",
  id_producto: 1,
  codigo_producto: "ARR-001",
  nombre_producto: "Arroz 1 libra",
  unidad_medida: "libra",
  estado_producto: true,
  nombre_categoria: "Granos",
  nombre_marca: "Diana",
  cantidad_disponible: "10.000",
  stock_minimo: "5.000",
  ultima_actualizacion: "2026-09-01T12:00:00.000Z",
  bajo_minimo: false,
};

function setupDatos() {
  server.use(
    rest.get("/api/sesion", (_req, res, ctx) => res(ctx.json({ usuario: mockUsuarioDueno }))),
    rest.get("/api/productos", (_req, res, ctx) => res(ctx.json({ productos: [producto] }))),
    rest.get("/api/categorias", (_req, res, ctx) => res(ctx.json({ categorias: [{ id_categoria: 1, nombre_categoria: "Granos" }] }))),
    rest.get("/api/marcas", (_req, res, ctx) => res(ctx.json({ marcas: [{ id_marca: 1, nombre_marca: "Diana" }] }))),
    rest.get("/api/proveedores", (_req, res, ctx) => res(ctx.json({ proveedores: [] }))),
    rest.get("/api/bodegas", (_req, res, ctx) => res(ctx.json({ bodegas: [{ id_bodega: 1, nombre_bodega: "Bodega Principal", ubicacion: "Zona 1", total_productos: 1, stock_total: "10.000" }] }))),
    rest.get("/api/gestion-inventario", (_req, res, ctx) => res(ctx.json({ stock: [stockRow], resumen: { filas: 1, bajo_minimo: 0 } }))),
    rest.get("/api/gestion-inventario/kardex", (_req, res, ctx) => res(ctx.json({ movimientos: [] })))
  );
}

describe("InventarioPage (Inventario + Catálogo unificados)", () => {
  beforeEach(() => {
    (useRouter as jest.Mock).mockReturnValue({ replace: mockReplace });
    (usePathname as jest.Mock).mockReturnValue("/inventario");
    setupDatos();
  });

  it("shows the 7 section tabs of the merged page", async () => {
    render(<InventarioPage />);

    expect(await screen.findByText("Inventario y catálogo")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Productos" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Precios" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Stock" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Operaciones" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Kardex" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bodegas" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Presentaciones" })).toBeInTheDocument();
  });

  it("shows the stock table by default and keeps the catalogo mounted", async () => {
    render(<InventarioPage />);

    expect((await screen.findAllByText("Bodega Principal")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Arroz 1 libra").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Solo bajo mínimo")).toBeInTheDocument();
  });

  it("switches to the products/prices catalogo sections", async () => {
    const user = userEvent.setup();
    render(<InventarioPage />);

    await screen.findAllByText("Bodega Principal");

    await user.click(screen.getByRole("button", { name: "Productos" }));
    expect(screen.getByRole("button", { name: "+ Nuevo producto" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Precios" }));
    expect(screen.getByText("P. Unitario")).toBeInTheDocument();
  });

  it("switches to operaciones, bodegas and kardex sections", async () => {
    const user = userEvent.setup();
    render(<InventarioPage />);

    await screen.findAllByText("Bodega Principal");

    await user.click(screen.getByRole("button", { name: "Operaciones" }));
    expect(screen.getByText("Entrada de stock")).toBeInTheDocument();
    expect(screen.getByText("Transferencia entre bodegas")).toBeInTheDocument();
    expect(screen.getByText("Ajuste de inventario")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Bodegas" }));
    expect(screen.getByRole("button", { name: "+ Nueva bodega" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Kardex" }));
    expect(await screen.findByText("No hay movimientos para estos filtros.")).toBeInTheDocument();
  });
});