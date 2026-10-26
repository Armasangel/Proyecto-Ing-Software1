import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { rest } from "msw";
import { setupServer } from "msw/node";

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(),
}));

import { useRouter } from "next/navigation";
import BodegaPage from "@/app/bodega/page";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => {
  server.resetHandlers();
  jest.clearAllMocks();
});
afterAll(() => server.close());

const mockReplace = jest.fn();
const mockUsuarioBodeguero = {
  id_usuario: 8,
  nombre: "Ana Bodega",
  correo: "ana@tienda.com",
  tipo_usuario: "BODEGUERO",
  id_bodega: 1,
};

const producto = {
  id_producto: 1,
  nombre_producto: "Leche entera",
  codigo_producto: "LEC-001",
  unidad_medida: "litro",
};

const pedido = {
  id_orden: 10,
  fecha_orden: "2026-10-25T15:00:00.000Z",
  estado: "CONFIRMADO",
  notas: "Entregar por la tarde",
  total: "120.00",
  nombre_cliente: "Pedro Díaz",
  codigo_cliente: "CLI-01",
  productos: [
    {
      id_detalle: 1,
      codigo_producto: "LEC-001",
      nombre_producto: "Leche entera",
      cantidad: "12",
      unidad_medida: "litro",
      id_bodega: 1,
      es_mi_bodega: true,
    },
  ],
};

const movimiento = {
  id_kardex: 5,
  fecha_movimiento: "2026-10-25T14:00:00.000Z",
  tipo_movimiento: "ENTRADA",
  cantidad: "20.000",
  descripcion: "Compra semanal",
  motivo: null,
  nombre_producto: "Leche entera",
  unidad_medida: "litro",
  nombre_presentacion: null,
  cantidad_presentacion: null,
};

function setupBase({ pedidos = [pedido] }: { pedidos?: unknown[] } = {}) {
  server.use(
    rest.get("/api/sesion", (_req, res, ctx) => res(ctx.json({ usuario: mockUsuarioBodeguero }))),
    rest.get("/api/bodega/pedidos", (_req, res, ctx) => res(ctx.json({ pedidos }))),
    rest.get("/api/productos", (_req, res, ctx) => res(ctx.json({ productos: [producto] }))),
    rest.get("/api/bodegas/simple", (_req, res, ctx) =>
      res(
        ctx.json({
          bodegas: [
            { id_bodega: 1, nombre_bodega: "Bodega Central" },
            { id_bodega: 2, nombre_bodega: "Bodega Tienda" },
          ],
        })
      )
    ),
    rest.get("/api/bodega/historial", (_req, res, ctx) => res(ctx.json({ movimientos: [movimiento] }))),
    rest.get("/api/productos/frecuentes", (_req, res, ctx) => res(ctx.json({ productos: [producto] }))),
    rest.get("/api/presentaciones", (_req, res, ctx) =>
      res(ctx.json({ presentaciones: [{ id_presentacion: 7, nombre_presentacion: "Caja x 12", factor_conversion: "12" }] }))
    )
  );
}

async function elegirProducto(user: ReturnType<typeof userEvent.setup>) {
  const input = screen.getByLabelText("Producto");
  await user.type(input, "Leche");
  await user.keyboard("{Enter}");
}

describe("BodegaPage", () => {
  beforeEach(() => {
    (useRouter as jest.Mock).mockReturnValue({ replace: mockReplace });
  });

  it("shows the live pedidos board and advances a pedido", async () => {
    setupBase();
    let patchBody: unknown = null;
    server.use(
      rest.patch("/api/ordenes/10", async (req, res, ctx) => {
        patchBody = await req.json();
        return res(ctx.json({ ok: true }));
      })
    );
    const user = userEvent.setup();
    render(<BodegaPage />);

    expect(await screen.findByText("Pedido #10")).toBeInTheDocument();
    expect(screen.getByText("Ana Bodega")).toBeInTheDocument();
    expect(screen.getByText("Nuevos")).toBeInTheDocument();
    expect(screen.getByText("En preparación")).toBeInTheDocument();
    expect(screen.getByText("Enviados")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Empezar a preparar" }));
    await waitFor(() => expect(patchBody).toEqual({ estado: "EN_PREPARACION" }));
  });

  it("registers an entrada and shows recent movements", async () => {
    setupBase();
    let postBody: unknown = null;
    server.use(
      rest.post("/api/inventario/entrada", async (req, res, ctx) => {
        postBody = await req.json();
        return res(ctx.json({ ok: true }));
      })
    );
    const user = userEvent.setup();
    render(<BodegaPage />);

    await user.click(await screen.findByRole("button", { name: "Entrada" }));
    await screen.findByText("Últimos movimientos de tu bodega");
    expect(screen.getByText(/Leche entera/)).toBeInTheDocument();

    await elegirProducto(user);
    await user.type(screen.getByLabelText("Cantidad"), "3");
    await user.type(screen.getByPlaceholderText("Detalle breve del movimiento"), "Compra semanal");
    await user.click(screen.getByRole("button", { name: "Registrar movimiento" }));

    await waitFor(() => expect(postBody).toEqual({
      id_producto: 1,
      cantidad: 3,
      tipo_ingreso: "UNIDADES",
      descripcion: "Compra semanal",
    }));
    expect(await screen.findByText("Movimiento registrado ✓")).toBeInTheDocument();
  });

  it("requires a destination and converts presentaciones when transferring", async () => {
    setupBase();
    let postBody: unknown = null;
    server.use(
      rest.post("/api/gestion-inventario/transferencia", async (req, res, ctx) => {
        postBody = await req.json();
        return res(ctx.json({ ok: true }));
      })
    );
    const user = userEvent.setup();
    render(<BodegaPage />);

    await user.click(await screen.findByRole("button", { name: "Traslado" }));
    await elegirProducto(user);
    await user.type(screen.getByLabelText("Cantidad"), "2");
    await screen.findByRole("option", { name: "Caja x 12" });
    await user.selectOptions(screen.getByLabelText("Presentación"), "7");

    await user.click(screen.getByRole("button", { name: "Registrar movimiento" }));
    expect(await screen.findByText("Selecciona la bodega destino")).toBeInTheDocument();
    expect(postBody).toBeNull();

    await user.selectOptions(screen.getByLabelText("Bodega destino"), "2");
    await user.click(screen.getByRole("button", { name: "Registrar movimiento" }));

    await waitFor(() =>
      expect(postBody).toEqual({
        id_bodega_destino: 2,
        id_producto: 1,
        cantidad: 24,
      })
    );
  });
});
