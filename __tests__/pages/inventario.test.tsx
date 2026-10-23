import { render, screen, waitFor } from "@testing-library/react";
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
    rest.get("/api/presentaciones", (req, res, ctx) => res(ctx.json({ presentaciones: req.url.searchParams.has("id_producto") ? [{ id_presentacion: 7, nombre_presentacion: "Libra", factor_conversion: "1.000" }] : [] }))),
    rest.get("/api/bodegas", (_req, res, ctx) => res(ctx.json({ bodegas: [{ id_bodega: 1, nombre_bodega: "Bodega Principal", ubicacion: "Zona 1", total_productos: 1, stock_total: "10.000" }] }))),
    rest.get("/api/gestion-inventario", (_req, res, ctx) => res(ctx.json({ stock: [stockRow], resumen: { filas: 1, bajo_minimo: 0 } }))),
    rest.get("/api/gestion-inventario/kardex", (_req, res, ctx) => res(ctx.json({ movimientos: [] }))),
    rest.get("/api/compras", (_req, res, ctx) => res(ctx.json({ productos: [producto], proveedores: [], compras: [], avisos: [] }))),
    rest.get("/api/recepciones", (_req, res, ctx) => res(ctx.json({ recepciones: [] }))),
    rest.get("/api/bodegas/simple", (_req, res, ctx) => res(ctx.json({ bodegas: [{ id_bodega: 1, nombre_bodega: "Bodega Principal" }] })))
  );
}

describe("InventarioPage (Inventario + Catálogo unificados)", () => {
  beforeEach(() => {
    (useRouter as jest.Mock).mockReturnValue({ replace: mockReplace });
    (usePathname as jest.Mock).mockReturnValue("/inventario");
    setupDatos();
  });

  it("shows the 8 section tabs with purchases and receipts inside inventory", async () => {
    render(<InventarioPage />);

    expect(await screen.findByText("Inventario y catálogo")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Productos" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Precios" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Stock" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Compra" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Entrada" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Operaciones" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Kardex" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bodegas" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Presentaciones" })).not.toBeInTheDocument();
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
    expect(screen.queryByRole("heading", { name: "Entrada de productos" })).not.toBeInTheDocument();
    expect(screen.getByText("Transferencia entre bodegas")).toBeInTheDocument();
    expect(screen.getByText("Ajuste de inventario")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Compra" }));
    expect(await screen.findByRole("heading", { name: "Compra de inventario" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Entrada" }));
    expect(await screen.findByRole("heading", { name: "Entrada de productos" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Bodegas" }));
    expect(screen.getByRole("button", { name: "+ Nueva bodega" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Kardex" }));
    expect(await screen.findByText("No hay movimientos para estos filtros.")).toBeInTheDocument();
  });

  it("loads, selects and creates presentations when editing a product, then saves everything together", async () => {
    const guardar = jest.fn();
    server.use(rest.put("/api/productos/1", async (req, res, ctx) => {
      guardar(await req.json());
      return res(ctx.json({ id_producto: 1 }));
    }));
    const user = userEvent.setup();
    render(<InventarioPage />);
    await user.click(await screen.findByRole("button", { name: "Productos" }));
    await user.click(await screen.findByRole("button", { name: "Editar" }));
    expect(await screen.findByText("Libra · 1 libra")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "+ Crear presentación" }));
    await user.type(screen.getByLabelText("Nombre de presentación"), "Bulto de 75");
    await user.type(screen.getByLabelText("Equivalencia en libra"), "75");
    await user.click(screen.getByRole("button", { name: "Agregar al producto" }));
    expect(guardar).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(guardar).toHaveBeenCalledWith(expect.objectContaining({
      id_categoria: 1, id_marca: 1,
      presentaciones: [
        { id_presentacion: 7, nombre_presentacion: "Libra", factor_conversion: 1 },
        { nombre_presentacion: "Bulto de 75", factor_conversion: 75 },
      ],
    })));
    expect(await screen.findByText("Producto actualizado ✓")).toBeInTheDocument();
  });

  it("discards presentation changes when the edit is cancelled", async () => {
    const guardar = jest.fn();
    server.use(rest.put("/api/productos/1", (_req, res, ctx) => { guardar(); return res(ctx.json({ id_producto: 1 })); }));
    const user = userEvent.setup();
    render(<InventarioPage />);
    await user.click(await screen.findByRole("button", { name: "Productos" }));
    await user.click(await screen.findByRole("button", { name: "Editar" }));
    await user.click(await screen.findByRole("button", { name: "Quitar Libra" }));
    await user.click(screen.getByRole("button", { name: /^Cancelar$/ }));
    expect(guardar).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Editar" }));
    expect(await screen.findByText("Libra · 1 libra")).toBeInTheDocument();
  });

  it("replaces litre presentations with bottle presentations when correcting the unit", async () => {
    server.use(
      rest.get("/api/productos", (_req, res, ctx) => res(ctx.json({ productos: [{ ...producto, unidad_medida: "litro" }] }))),
      rest.get("/api/presentaciones", (req, res, ctx) => res(ctx.json({ presentaciones: req.url.searchParams.has("id_producto")
        ? [{ id_presentacion: 9, nombre_presentacion: "Litro", factor_conversion: "1.000" }] : [] }))),
    );
    const guardar = jest.fn();
    server.use(rest.put("/api/productos/1", async (req, res, ctx) => { guardar(await req.json()); return res(ctx.json({ id_producto: 1 })); }));
    const user = userEvent.setup();
    render(<InventarioPage />);
    await user.click(await screen.findByRole("button", { name: "Productos" }));
    await user.click(await screen.findByRole("button", { name: "Editar" }));
    await screen.findByText("Litro · 1 litro");
    await user.clear(screen.getByLabelText("Unidad de medida"));
    await user.type(screen.getByLabelText("Unidad de medida"), "botella");
    expect(screen.getByText("Botella · 1 botella")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Quitar Litro" })).not.toBeInTheDocument();
    expect(screen.getByText(/10 litro pasarán a ser 10 botella/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(guardar).toHaveBeenCalledWith(expect.objectContaining({
      unidad_medida: "botella", precio_unitario: 4.5,
      presentaciones: [{ nombre_presentacion: "Botella", factor_conversion: 1 }],
    })));
  });

  it("restores the original selection when reverting the unit before saving", async () => {
    const user = userEvent.setup();
    render(<InventarioPage />);
    await user.click(await screen.findByRole("button", { name: "Productos" }));
    await user.click(await screen.findByRole("button", { name: "Editar" }));
    await screen.findByText("Libra · 1 libra");
    const unidad = screen.getByLabelText("Unidad de medida");
    await user.clear(unidad);
    await user.type(unidad, "botella");
    await user.clear(unidad);
    await user.type(unidad, "lb");
    expect(screen.getByText("Libra · 1 lb")).toBeInTheDocument();
    expect(screen.queryByText(/Al guardar se corregirá la unidad/)).not.toBeInTheDocument();
  });

  it("blocks saving if existing presentations fail to load and allows retrying", async () => {
    server.use(rest.get("/api/presentaciones", (_req, res, ctx) => res(ctx.status(500))));
    const user = userEvent.setup();
    render(<InventarioPage />);
    await user.click(await screen.findByRole("button", { name: "Productos" }));
    await user.click(await screen.findByRole("button", { name: "Editar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudieron cargar");
    expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeDisabled();
    server.use(rest.get("/api/presentaciones", (_req, res, ctx) => res(ctx.json({ presentaciones: [{ id_presentacion: 7, nombre_presentacion: "Libra", factor_conversion: "1.000" }] }))));
    await user.click(screen.getByRole("button", { name: "Reintentar carga" }));
    expect(await screen.findByText("Libra · 1 libra")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeEnabled();
  });

  it("creates a brand and categories from product editing and selects them in the intended slots", async () => {
    let siguienteCategoria = 2;
    server.use(
      rest.post("/api/categorias", async (req, res, ctx) => {
        const body = await req.json();
        return res(ctx.status(201), ctx.json({ categoria: { id_categoria: siguienteCategoria++, nombre_categoria: body.nombre_categoria } }));
      }),
      rest.post("/api/marcas", async (req, res, ctx) => {
        const body = await req.json();
        return res(ctx.status(201), ctx.json({ marca: { id_marca: 2, nombre_marca: body.nombre_marca } }));
      }),
    );
    const guardar = jest.fn();
    server.use(rest.put("/api/productos/1", async (req, res, ctx) => { guardar(await req.json()); return res(ctx.json({ id_producto: 1 })); }));
    const user = userEvent.setup();
    render(<InventarioPage />);
    await user.click(await screen.findByRole("button", { name: "Productos" }));
    await user.click(await screen.findByRole("button", { name: "Editar" }));
    await screen.findByText("Libra · 1 libra");

    for (const [numero, nombre] of [[2, "Alimentos"], [3, "Básicos"]] as const) {
      await user.click(screen.getByRole("button", { name: `+ Crear categoría ${numero}` }));
      await user.type(screen.getByLabelText("Nombre de nueva categoría"), nombre);
      await user.click(screen.getByRole("button", { name: /^Crear categoría$/ }));
      await waitFor(() => expect(screen.getByLabelText(`Categoría ${numero} (opcional)`)).toHaveValue(nombre));
    }
    await user.click(screen.getByRole("button", { name: "+ Crear marca" }));
    await user.type(screen.getByLabelText("Nombre de nueva marca"), "Marca nueva");
    await user.click(screen.getByRole("button", { name: /^Crear marca$/ }));
    await waitFor(() => expect(screen.getByLabelText("Marca")).toHaveValue("Marca nueva"));
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(guardar).toHaveBeenCalledWith(expect.objectContaining({ id_categoria: 1, id_categoria_2: 2, id_categoria_3: 3, id_marca: 2 })));
  });

  it("preloads optional categories and can clear them to null", async () => {
    server.use(
      rest.get("/api/productos", (_req, res, ctx) => res(ctx.json({ productos: [{ ...producto, id_categoria_2: 2, id_categoria_3: 3, nombre_categoria_2: "Alimentos", nombre_categoria_3: "Básicos" }] }))),
      rest.get("/api/categorias", (_req, res, ctx) => res(ctx.json({ categorias: [
        { id_categoria: 1, nombre_categoria: "Granos" }, { id_categoria: 2, nombre_categoria: "Alimentos" }, { id_categoria: 3, nombre_categoria: "Básicos" },
      ] }))),
    );
    const guardar = jest.fn();
    server.use(rest.put("/api/productos/1", async (req, res, ctx) => { guardar(await req.json()); return res(ctx.json({ id_producto: 1 })); }));
    const user = userEvent.setup();
    render(<InventarioPage />);
    await user.click(await screen.findByRole("button", { name: "Productos" }));
    expect(await screen.findByText("Granos · Alimentos · Básicos")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Editar" }));
    await screen.findByText("Libra · 1 libra");
    expect(screen.getByLabelText("Categoría 2 (opcional)")).toHaveValue("Alimentos");
    expect(screen.getByLabelText("Categoría 3 (opcional)")).toHaveValue("Básicos");
    await user.click(screen.getByLabelText("Categoría 2 (opcional)"));
    await user.click(screen.getByRole("button", { name: "Dejar Categoría 2 (opcional) sin categoría" }));
    await user.click(screen.getByLabelText("Categoría 3 (opcional)"));
    await user.click(screen.getByRole("button", { name: "Dejar Categoría 3 (opcional) sin categoría" }));
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(guardar).toHaveBeenCalledWith(expect.objectContaining({ id_categoria: 1, id_categoria_2: null, id_categoria_3: null })));
  });

  it("also offers brand and category creation when adding a new product", async () => {
    const user = userEvent.setup();
    render(<InventarioPage />);
    await user.click(await screen.findByRole("button", { name: "Productos" }));
    await user.click(screen.getByRole("button", { name: "+ Nuevo producto" }));
    expect(screen.getByLabelText("Categoría principal *")).toHaveValue("");
    expect(screen.getByLabelText("Categoría 2 (opcional)")).toHaveValue("");
    expect(screen.getByLabelText("Categoría 3 (opcional)")).toHaveValue("");
    expect(screen.getByRole("button", { name: "+ Crear marca" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+ Crear categoría 1" })).toBeInTheDocument();
  });
});
