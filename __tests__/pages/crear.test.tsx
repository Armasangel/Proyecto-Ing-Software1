import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { rest } from "msw";
import { setupServer } from "msw/node";

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(),
}));

import { useRouter, usePathname } from "next/navigation";
import CrearRegistrosPage from "@/app/crear/page";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => {
  server.resetHandlers();
  jest.clearAllMocks();
});
afterAll(() => server.close());

const mockRouter = { replace: jest.fn() };
const mockUsuarioDueno = {
  id_usuario: 1,
  nombre: "Ana Dueña",
  correo: "ana@tienda.com",
  tipo_usuario: "DUENO",
};

beforeEach(() => {
  (useRouter as jest.Mock).mockReturnValue(mockRouter);
  (usePathname as jest.Mock).mockReturnValue("/crear");
  server.use(rest.get("/api/sesion", (_req, res, ctx) => res(ctx.json({ usuario: mockUsuarioDueno }))));
});

async function renderPage() {
  render(<CrearRegistrosPage />);
  expect(await screen.findByRole("heading", { name: "Crear registros" })).toBeInTheDocument();
}

describe("CrearRegistrosPage", () => {
  it("muestra la sección de cliente y crea un cliente", async () => {
    let body: Record<string, unknown> | undefined;
    server.use(
      rest.post("/api/clientes", async (req, res, ctx) => {
        body = await req.json();
        return res(ctx.status(201), ctx.json({ id_cliente: 7 }));
      })
    );
    const user = userEvent.setup();
    await renderPage();

    expect(screen.getByRole("heading", { name: "Crear cliente" })).toBeInTheDocument();
    await user.type(screen.getByLabelText(/^Nombre/), "Ana López");
    await user.type(screen.getByLabelText(/^Correo/), "ana@cliente.com");
    await user.selectOptions(screen.getByLabelText(/^Tipo de cliente/), "MAYORISTA");
    await user.click(screen.getByRole("button", { name: "Crear cliente" }));

    expect(await screen.findByText(/Cliente «Ana López» creado/)).toBeInTheDocument();
    expect(body).toMatchObject({
      nombre: "Ana López",
      correo: "ana@cliente.com",
      tipo_cliente: "MAYORISTA",
      limite_deuda: null,
    });
  });

  it("crea una bodega", async () => {
    let body: Record<string, unknown> | undefined;
    server.use(
      rest.post("/api/bodegas", async (req, res, ctx) => {
        body = await req.json();
        return res(ctx.status(201), ctx.json({ bodega: { id_bodega: 3 } }));
      })
    );
    const user = userEvent.setup();
    await renderPage();

    await user.click(screen.getByRole("tab", { name: "Bodega" }));
    await user.type(screen.getByLabelText(/^Nombre de la bodega/), "Bodega Sur");
    await user.type(screen.getByLabelText(/^Ubicación/), "Zona 12");
    await user.click(screen.getByRole("button", { name: "Crear bodega" }));

    expect(await screen.findByText(/Bodega «Bodega Sur» creada/)).toBeInTheDocument();
    expect(body).toEqual({ nombre_bodega: "Bodega Sur", ubicacion: "Zona 12" });
  });

  it("crea una categoría y una marca desde la misma sección", async () => {
    const bodies: Array<Record<string, unknown>> = [];
    server.use(
      rest.post("/api/categorias", async (req, res, ctx) => {
        bodies.push(await req.json());
        return res(ctx.status(201), ctx.json({ categoria: { id_categoria: 1 } }));
      }),
      rest.post("/api/marcas", async (req, res, ctx) => {
        bodies.push(await req.json());
        return res(ctx.status(201), ctx.json({ marca: { id_marca: 1 } }));
      })
    );
    const user = userEvent.setup();
    await renderPage();

    await user.click(screen.getByRole("tab", { name: "Categoría" }));
    await user.type(screen.getByLabelText(/^Nombre de la categoría/), "Bebidas");
    await user.click(screen.getByRole("button", { name: "Crear categoría" }));
    expect(await screen.findByText(/Se creó la categoría «Bebidas»/)).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Marca" }));
    await user.type(screen.getByLabelText(/^Nombre de la marca/), "Marca Andina");
    await user.click(screen.getByRole("button", { name: "Crear marca" }));
    expect(await screen.findByText(/Se creó la marca «Marca Andina»/)).toBeInTheDocument();

    expect(bodies).toEqual([{ nombre_categoria: "Bebidas" }, { nombre_marca: "Marca Andina" }]);
  });

  it("crea una presentación para un producto existente", async () => {
    let body: Record<string, unknown> | undefined;
    server.use(
      rest.get("/api/productos", (_req, res, ctx) =>
        res(
          ctx.json({
            productos: [
              { id_producto: 5, codigo_producto: "GAS-01", nombre_producto: "Gaseosa" },
            ],
          })
        )
      ),
      rest.post("/api/presentaciones", async (req, res, ctx) => {
        body = await req.json();
        return res(ctx.status(201), ctx.json({ presentacion: { id_presentacion: 2 } }));
      })
    );
    const user = userEvent.setup();
    await renderPage();

    await user.click(screen.getByRole("tab", { name: "Presentación" }));
    expect(
      await screen.findByRole("option", { name: "GAS-01 — Gaseosa" })
    ).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText(/^Producto/), "5");
    await user.type(screen.getByLabelText(/^Nombre de la presentación/), "Caja de 24");
    await user.type(screen.getByLabelText(/^Factor de conversión/), "24");
    await user.click(screen.getByRole("button", { name: "Crear presentación" }));

    expect(await screen.findByText(/Presentación «Caja de 24» creada/)).toBeInTheDocument();
    expect(body).toEqual({
      id_producto: 5,
      nombre_presentacion: "Caja de 24",
      factor_conversion: 24,
    });
  });

  it("valida la presentación obligatoria de un producto líquido y luego lo crea", async () => {
    let body: Record<string, unknown> | undefined;
    server.use(
      rest.get("/api/categorias", (_req, res, ctx) =>
        res(ctx.json({ categorias: [{ id_categoria: 1, nombre_categoria: "Lácteos" }] }))
      ),
      rest.get("/api/marcas", (_req, res, ctx) =>
        res(ctx.json({ marcas: [{ id_marca: 2, nombre_marca: "Láctea" }] }))
      ),
      rest.get("/api/proveedores", (_req, res, ctx) =>
        res(ctx.json({ proveedores: [{ id_proveedor: 3, nombre_proveedor: "Distribuidora" }] }))
      ),
      rest.post("/api/productos", async (req, res, ctx) => {
        body = await req.json();
        return res(ctx.status(201), ctx.json({ id_producto: 9 }));
      })
    );
    const user = userEvent.setup();
    await renderPage();

    await user.click(screen.getByRole("tab", { name: "Producto" }));
    await user.type(screen.getByLabelText(/^Código/), "LEC-01");
    await user.type(screen.getByLabelText(/^Nombre/), "Leche entera");
    await user.type(screen.getByLabelText(/^Unidad de medida/), "botella");
    expect(await screen.findByRole("option", { name: "Lácteos" })).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText(/^Categoría/), "1");
    await user.selectOptions(screen.getByLabelText(/^Marca/), "2");

    await user.click(screen.getByRole("button", { name: "Crear producto" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Los productos líquidos necesitan al menos una presentación tipo caja"
    );

    await user.click(screen.getByRole("button", { name: "+ Agregar caja" }));
    await user.type(screen.getByPlaceholderText("24"), "12");
    await user.click(screen.getByRole("button", { name: "Crear producto" }));

    expect(await screen.findByText(/Producto «Leche entera» creado/)).toBeInTheDocument();
    expect(body).toMatchObject({
      codigo_producto: "LEC-01",
      nombre_producto: "Leche entera",
      unidad_medida: "botella",
      id_categoria: 1,
      id_marca: 2,
      presentaciones: [{ nombre_presentacion: "Caja", factor_conversion: 12 }],
    });
  });

  it("crea un usuario bodeguero con bodega asignada", async () => {
    let body: Record<string, unknown> | undefined;
    server.use(
      rest.get("/api/bodegas/simple", (_req, res, ctx) =>
        res(ctx.json({ bodegas: [{ id_bodega: 4, nombre_bodega: "Bodega Central" }] }))
      ),
      rest.post("/api/usuarios", async (req, res, ctx) => {
        body = await req.json();
        return res(ctx.status(201), ctx.json({ usuario: { id_usuario: 8 } }));
      })
    );
    const user = userEvent.setup();
    await renderPage();

    await user.click(screen.getByRole("tab", { name: "Usuario" }));
    await user.type(screen.getByLabelText(/^Nombre/), "Carlos Bodega");
    await user.type(screen.getByLabelText(/^Correo/), "carlos@tienda.com");
    await user.type(screen.getByLabelText(/^Contraseña/), "clave-segura-2026");
    await user.selectOptions(screen.getByLabelText(/^Rol/), "BODEGUERO");
    expect(
      await screen.findByRole("option", { name: "Bodega Central" })
    ).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText(/^Bodega asignada/), "4");
    await user.click(screen.getByRole("button", { name: "Crear usuario" }));

    expect(await screen.findByText(/Usuario «Carlos Bodega» creado como Bodeguero/)).toBeInTheDocument();
    expect(body).toMatchObject({
      nombre: "Carlos Bodega",
      correo: "carlos@tienda.com",
      tipo_usuario: "BODEGUERO",
      id_bodega: 4,
      requiere_2fa: true,
    });
  });

  it("crea un descuento con tramos y asignación opcional", async () => {
    let body: Record<string, unknown> | undefined;
    server.use(
      rest.post("/api/descuentos", async (req, res, ctx) => {
        body = await req.json();
        return res(ctx.status(201), ctx.json({ id_descuento: 6 }));
      })
    );
    const user = userEvent.setup();
    await renderPage();

    await user.click(screen.getByRole("tab", { name: "Descuento" }));
    await user.type(screen.getByLabelText(/^Nombre del descuento/), "Mayoreo 12+");
    await user.type(screen.getByLabelText("Cantidad desde del tramo 1"), "12");
    await user.type(screen.getByLabelText("Porcentaje del tramo 1"), "10");
    await user.selectOptions(screen.getByLabelText(/^Asignar a tipo de cliente/), "MAYORISTA");
    await user.click(screen.getByRole("button", { name: "Crear descuento" }));

    expect(await screen.findByText(/Descuento «Mayoreo 12\+» creado/)).toBeInTheDocument();
    expect(body).toEqual({
      nombre: "Mayoreo 12+",
      tipo: "PORCENTAJE",
      tramos: [{ cantidad_desde: 12, porcentaje: 10 }],
      asignaciones: [{ tipo_cliente: "MAYORISTA" }],
    });
  });

  it("muestra un error del servidor sin perder lo escrito", async () => {
    server.use(
      rest.post("/api/clientes", (_req, res, ctx) =>
        res(ctx.status(409), ctx.json({ error: "Ya existe un cliente con ese nombre" }))
      )
    );
    const user = userEvent.setup();
    await renderPage();

    await user.type(screen.getByLabelText(/^Nombre/), "Cliente Duplicado");
    await user.click(screen.getByRole("button", { name: "Crear cliente" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Ya existe un cliente con ese nombre");
    await waitFor(() => expect(screen.getByLabelText(/^Nombre/)).toHaveValue("Cliente Duplicado"));
  });
});
