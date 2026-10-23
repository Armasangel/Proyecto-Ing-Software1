import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { rest } from "msw";
import { setupServer } from "msw/node";

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(),
}));

import { useRouter, usePathname } from "next/navigation";
import ProductosPage from "@/app/productos/page";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => { server.resetHandlers(); jest.clearAllMocks(); });
afterAll(() => server.close());

const mockUsuarioDueno = {
  id_usuario: 1,
  nombre: "Juan Pérez",
  correo: "juan@tienda.com",
  tipo_usuario: "DUENO",
};

const producto = {
  id_producto: 1,
  codigo_producto: "ARR-001",
  nombre_producto: "Arroz 1 libra",
  precio_unitario: "4.50",
  precio_mayoreo: "4.00",
  unidad_medida: "libra",
  estado_producto: true,
  caducidad: false,
  fecha_caducidad: null,
  exento_iva: false,
  id_categoria: 1,
  id_marca: 1,
  nombre_categoria: "Granos",
  nombre_marca: "Diana",
};

function setupDatos() {
  server.use(
    rest.get("/api/sesion", (_req, res, ctx) => res(ctx.json({ usuario: mockUsuarioDueno }))),
    rest.get("/api/productos", (_req, res, ctx) => res(ctx.json({ productos: [producto] }))),
    rest.get("/api/categorias", (_req, res, ctx) =>
      res(ctx.json({ categorias: [{ id_categoria: 1, nombre_categoria: "Granos" }] }))
    ),
    rest.get("/api/marcas", (_req, res, ctx) =>
      res(ctx.json({ marcas: [{ id_marca: 1, nombre_marca: "Diana" }] }))
    ),
    rest.get("/api/proveedores", (_req, res, ctx) => res(ctx.json({ proveedores: [] })))
  );
}

describe("ProductosPage", () => {
  beforeEach(() => {
    (useRouter as jest.Mock).mockReturnValue({ replace: jest.fn() });
    (usePathname as jest.Mock).mockReturnValue("/productos");
    setupDatos();
  });

  it("muestra el catálogo y crea un producto con el formulario compartido", async () => {
    let body: Record<string, unknown> | undefined;
    server.use(
      rest.post("/api/productos", async (req, res, ctx) => {
        body = await req.json();
        return res(ctx.status(201), ctx.json({ id_producto: 2 }));
      })
    );
    const user = userEvent.setup();
    render(<ProductosPage />);

    expect(await screen.findByText("Arroz 1 libra")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "+ Agregar producto" }));
    await user.type(screen.getByLabelText(/^Código/), "CAF-01");
    await user.type(screen.getByLabelText(/^Nombre/), "Café molido");
    await user.type(screen.getByLabelText(/^Unidad de medida/), "libra");
    await user.selectOptions(screen.getByLabelText(/^Categoría/), "1");
    await user.selectOptions(screen.getByLabelText(/^Marca/), "1");
    await user.click(screen.getByRole("button", { name: "Crear producto" }));

    await waitFor(() =>
      expect(body).toMatchObject({
        codigo_producto: "CAF-01",
        nombre_producto: "Café molido",
        unidad_medida: "libra",
        id_categoria: 1,
        id_marca: 1,
      })
    );
    expect(screen.queryByText("Nuevo producto")).not.toBeInTheDocument();
  });
});
