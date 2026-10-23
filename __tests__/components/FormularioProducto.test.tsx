import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { rest } from "msw";
import { setupServer } from "msw/node";

import { FormularioProducto } from "@/components/productos/FormularioProducto";
import type { ProductoEditable } from "@/lib/productos-form";

const server = setupServer(
  rest.get("/api/categorias", (_req, res, ctx) =>
    res(ctx.json({ categorias: [{ id_categoria: 1, nombre_categoria: "Lácteos" }] }))
  ),
  rest.get("/api/marcas", (_req, res, ctx) =>
    res(ctx.json({ marcas: [{ id_marca: 2, nombre_marca: "Láctea" }] }))
  ),
  rest.get("/api/proveedores", (_req, res, ctx) =>
    res(ctx.json({ proveedores: [{ id_proveedor: 3, nombre_proveedor: "Distribuidora", nit_proveedor: "123" }] }))
  )
);

beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const producto: ProductoEditable = {
  id_producto: 7,
  codigo_producto: "LEC-01",
  nombre_producto: "Leche entera",
  precio_unitario: "25.00",
  precio_mayoreo: null,
  unidad_medida: "botella",
  id_categoria: 1,
  id_marca: 2,
  caducidad: true,
  fecha_caducidad: "2026-11-30T06:00:00.000Z",
  exento_iva: true,
  estado_producto: false,
};

describe("FormularioProducto", () => {
  it("crea un producto con proveedor y presentaciones", async () => {
    let body: Record<string, unknown> | null = null;
    server.use(
      rest.post("/api/productos", async (req, res, ctx) => {
        body = (await req.json()) as Record<string, unknown>;
        return res(ctx.status(201), ctx.json({ id_producto: 9 }));
      })
    );
    const onGuardado = jest.fn();
    const user = userEvent.setup();
    render(<FormularioProducto onGuardado={onGuardado} />);

    await user.type(screen.getByLabelText(/^Código/), "LEC-02");
    await user.type(screen.getByLabelText(/^Nombre/), "Leche descremada");
    await user.type(screen.getByLabelText(/^Unidad de medida/), "botella");
    expect(await screen.findByRole("option", { name: "Lácteos" })).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText(/^Categoría/), "1");
    await user.selectOptions(screen.getByLabelText(/^Marca/), "2");

    await user.type(screen.getByPlaceholderText(/Buscar proveedor/), "Distribuidora");
    await user.click(screen.getByRole("button", { name: /Distribuidora/ }));

    await user.click(screen.getByRole("button", { name: "+ Agregar caja" }));
    await user.type(screen.getByPlaceholderText("24"), "12");
    await user.click(screen.getByRole("button", { name: "Crear producto" }));

    expect(await screen.findByText("Producto «Leche descremada» creado.")).toBeInTheDocument();
    expect(body).toMatchObject({
      codigo_producto: "LEC-02",
      nombre_producto: "Leche descremada",
      unidad_medida: "botella",
      id_categoria: 1,
      id_marca: 2,
      id_proveedores: [3],
      presentaciones: [{ nombre_presentacion: "Caja", factor_conversion: 12 }],
    });
    expect(onGuardado).toHaveBeenCalledWith({ idProducto: 9, esEdicion: false });
  });

  it("en edición precarga los datos y envía solo los campos básicos", async () => {
    let body: Record<string, unknown> | null = null;
    server.use(
      rest.put("/api/productos/7", async (req, res, ctx) => {
        body = (await req.json()) as Record<string, unknown>;
        return res(ctx.json({ id_producto: 7 }));
      })
    );
    const onGuardado = jest.fn();
    const user = userEvent.setup();
    render(
      <FormularioProducto
        producto={producto}
        variant="modal"
        onGuardado={onGuardado}
        onCancelar={jest.fn()}
      />
    );

    await waitFor(() => expect(screen.getByLabelText(/^Categoría/)).toHaveValue("1"));
    expect(screen.getByLabelText(/^Código/)).toHaveValue("LEC-01");
    expect(screen.getByLabelText(/^Marca/)).toHaveValue("2");
    expect(screen.getByLabelText("Exento de IVA")).toBeChecked();
    expect(screen.getByLabelText("Producto activo")).not.toBeChecked();
    expect(screen.queryByText(/Presentaciones por mayor/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Proveedores \(opcional\)/)).not.toBeInTheDocument();

    const nombre = screen.getByLabelText(/^Nombre/);
    await user.clear(nombre);
    await user.type(nombre, "Leche entera 1L");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(onGuardado).toHaveBeenCalledWith({ idProducto: 7, esEdicion: true }));
    expect(body).toMatchObject({
      codigo_producto: "LEC-01",
      nombre_producto: "Leche entera 1L",
      id_categoria: 1,
      id_marca: 2,
      fecha_caducidad: "2026-11-30",
      exento_iva: true,
      estado_producto: false,
    });
    expect(body).not.toHaveProperty("id_proveedores");
    expect(body).not.toHaveProperty("presentaciones");
  });

  it("muestra el error del servidor y conserva los valores", async () => {
    server.use(
      rest.post("/api/productos", (_req, res, ctx) =>
        res(ctx.status(409), ctx.json({ error: "El código de producto ya existe" }))
      )
    );
    const user = userEvent.setup();
    render(<FormularioProducto />);

    await user.type(screen.getByLabelText(/^Código/), "DUP-01");
    await user.type(screen.getByLabelText(/^Nombre/), "Duplicado");
    await user.type(screen.getByLabelText(/^Unidad de medida/), "unidad");
    expect(await screen.findByRole("option", { name: "Lácteos" })).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText(/^Categoría/), "1");
    await user.selectOptions(screen.getByLabelText(/^Marca/), "2");
    await user.click(screen.getByRole("button", { name: "Crear producto" }));

    expect(await screen.findByText("El código de producto ya existe")).toBeInTheDocument();
    expect(screen.getByLabelText(/^Código/)).toHaveValue("DUP-01");
  });
});
