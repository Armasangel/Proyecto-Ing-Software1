import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { rest } from "msw";
import { setupServer } from "msw/node";

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(),
}));

import { useRouter, usePathname } from "next/navigation";
import PedidosPage from "@/app/ordenes/page";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => { server.resetHandlers(); jest.clearAllMocks(); });
afterAll(() => server.close());

const mockUsuarioDueno = { id_usuario: 1, nombre: "Juan Pérez", correo: "juan@tienda.com", tipo_usuario: "DUENO" };

const orden = (over: Record<string, unknown> = {}) => ({
  id_orden: 10,
  id_cliente: 1,
  id_usuario: 1,
  id_venta: 7,
  fecha_orden: "2026-10-12T15:00:00.000Z",
  estado: "ENVIADO",
  notas: "Entrega a domicilio: Zona 1",
  total: "120.00",
  nombre_cliente: "Pedro Díaz",
  correo_cliente: "pedro@correo.com",
  tipo_cliente: "MINORISTA",
  nombre_usuario: "Juan Pérez",
  productos: [
    { id_detalle: 1, id_producto: 1, codigo_producto: "PROD-001", nombre_producto: "Leche", id_bodega: 1, nombre_bodega: "Central", cantidad: "12", precio_unitario: "10", subtotal: "120", id_presentacion: null, nombre_presentacion: null, cantidad_presentacion: null },
  ],
  ...over,
});

function setup(ordenes: unknown[]) {
  server.use(
    rest.get("/api/sesion", (_req, res, ctx) => res(ctx.json({ usuario: mockUsuarioDueno }))),
    rest.get("/api/ordenes", (_req, res, ctx) => res(ctx.json({ ordenes })))
  );
}

describe("PedidosPage (antes Órdenes)", () => {
  beforeEach(() => {
    (useRouter as jest.Mock).mockReturnValue({ replace: jest.fn() });
    (usePathname as jest.Mock).mockReturnValue("/ordenes");
  });

  it("is a follow-up list: no creation form, and sends you to Ventas to create", async () => {
    setup([orden()]);
    render(<PedidosPage />);
    expect(await screen.findByText("Pedro Díaz")).toBeInTheDocument();
    expect(screen.getAllByText("Pedidos de entrega").length).toBeGreaterThan(0);
    expect(screen.queryByText("Registrar orden")).not.toBeInTheDocument();
    expect(screen.queryByText("+ Cliente nuevo")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ir a Ventas" })).toHaveAttribute("href", "/ventas");
    expect(screen.getByText("#7")).toBeInTheDocument(); // venta de origen
  });

  it("marks a sent pedido as delivered via PATCH", async () => {
    let body: unknown = null;
    setup([orden()]);
    server.use(
      rest.patch("/api/ordenes/10", async (req, res, ctx) => {
        body = await req.json();
        return res(ctx.json({ mensaje: "ok" }));
      })
    );
    const user = userEvent.setup();
    render(<PedidosPage />);
    await user.click(await screen.findByRole("button", { name: "Marcar entregado" }));
    await waitFor(() => expect(body).toEqual({ estado: "ENTREGADO" }));
    expect(await screen.findByText(/Pedido #10 actualizado a Entregado/)).toBeInTheDocument();
  });

  it("does not offer to cancel a pedido that belongs to a venta (it is undone from Ventas)", async () => {
    setup([orden({ estado: "CONFIRMADO" }), orden({ id_orden: 11, id_venta: null, estado: "CONFIRMADO", nombre_cliente: "Legado" })]);
    render(<PedidosPage />);
    await screen.findByText("Legado");
    // Solo el pedido antiguo (sin venta) conserva "Cancelar".
    expect(screen.getAllByRole("button", { name: "Cancelar" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Preparar" })).toHaveLength(2);
  });
});
