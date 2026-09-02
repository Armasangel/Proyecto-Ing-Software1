import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { rest } from "msw";
import { setupServer } from "msw/node";

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(),
}));

import { useRouter, usePathname } from "next/navigation";
import VentasPage from "@/app/ventas/page";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => { server.resetHandlers(); jest.clearAllMocks(); });
afterAll(() => server.close());

const mockReplace = jest.fn();
const mockUsuarioEmpleado = { id_usuario: 2, nombre: "María", correo: "maria@tienda.com", tipo_usuario: "EMPLEADO" };

const clientes = [
  { id_cliente: 1, nombre: "Carlos Ruiz", correo: "carlos@email.com", tipo_cliente: "MINORISTA" },
];

const productos = [
  { id_producto: 1, codigo_producto: "PROD-001", nombre_producto: "Leche Entera", precio_unitario: "25.00", precio_mayoreo: "22.00", unidad_medida: "Litro", estado_producto: true },
];

const bodegas = [
  { id_bodega: 1, nombre_bodega: "Bodega Central" },
];

const stock = [{ id_bodega: 1, id_producto: 1, cantidad_disponible: 100 }];

function setupServerVentas() {
  server.use(
    rest.get("/api/sesion", (_req, res, ctx) => res(ctx.json({ usuario: mockUsuarioEmpleado }))),
    rest.get("/api/clientes", (_req, res, ctx) => res(ctx.json({ clientes }))),
    rest.get("/api/productos", (_req, res, ctx) => res(ctx.json({ productos }))),
    rest.get("/api/bodegas", (_req, res, ctx) => res(ctx.json({ bodegas }))),
    rest.get("/api/gestion-inventario", (_req, res, ctx) => res(ctx.json({ stock }))),
    rest.get("/api/ventas", (_req, res, ctx) => res(ctx.json({ ventas: [] })))
  );
}

async function llenarFormulario(user: ReturnType<typeof userEvent.setup>) {
  // Espera a que lleguen las opciones (y el resto del form).
  await screen.findByText("Carlos Ruiz (carlos@email.com)");
  await screen.findByText("[PROD-001] Leche Entera");
  await screen.findByText("Bodega Central");

  const combos = screen.getAllByRole("combobox");
  // Orden del DOM: cliente, estado de pago, tipo de venta, tipo de entrega, producto, bodega.
  await user.selectOptions(combos[0], "1"); // cliente
  await user.selectOptions(combos[4], "1"); // producto
  await user.selectOptions(combos[5], "1"); // bodega

  const spinbuttons = screen.getAllByRole("spinbutton");
  await user.type(spinbuttons[0], "2"); // cantidad → total Q50.00
}

describe("VentasPage", () => {
  beforeEach(() => {
    (useRouter as jest.Mock).mockReturnValue({ replace: mockReplace, push: mockReplace });
    (usePathname as jest.Mock).mockReturnValue("/ventas");
  });

  it("asks for confirmation with an option to cancel before registering", async () => {
    setupServerVentas();
    const user = userEvent.setup();
    render(<VentasPage />);

    await llenarFormulario(user);
    const registrar = screen.getByRole("button", { name: "Registrar venta" });
    expect(registrar).toBeEnabled();

    await user.click(registrar);
    expect(screen.getByText("¿Confirmar esta venta?")).toBeInTheDocument();
    expect(screen.getByText(/Carlos Ruiz · 1 producto\(s\) · Total: Q50\.00/)).toBeInTheDocument();

    // Cancelar cierra el modal y no registra nada.
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByText("¿Confirmar esta venta?")).not.toBeInTheDocument();
  });

  it("keeps the submit disabled while the form is incomplete", async () => {
    setupServerVentas();
    const user = userEvent.setup();
    render(<VentasPage />);

    await user.click(await screen.findByRole("button", { name: "Registrar venta" }));
    // Con el form vacío el botón está deshabilitado y no abre el modal.
    expect(screen.queryByText("¿Confirmar esta venta?")).not.toBeInTheDocument();
  });

  it("registers the sale and shows an undo option that calls the anular API", async () => {
    let anularCalled = false;
    server.use(
      rest.get("/api/sesion", (_req, res, ctx) => res(ctx.json({ usuario: mockUsuarioEmpleado }))),
      rest.get("/api/clientes", (_req, res, ctx) => res(ctx.json({ clientes }))),
      rest.get("/api/productos", (_req, res, ctx) => res(ctx.json({ productos }))),
      rest.get("/api/bodegas", (_req, res, ctx) => res(ctx.json({ bodegas }))),
      rest.get("/api/gestion-inventario", (_req, res, ctx) => res(ctx.json({ stock }))),
      rest.get("/api/ventas", (_req, res, ctx) => res(ctx.json({ ventas: [] }))),
      rest.post("/api/ventas", (_req, res, ctx) =>
        res(ctx.json({ id_venta: 5, total: 50 }))
      ),
      rest.post("/api/ventas/5/anular", (_req, res, ctx) => {
        anularCalled = true;
        return res(ctx.json({ mensaje: "Venta deshecha, el stock fue restaurado.", id_venta: 5 }));
      })
    );

    const user = userEvent.setup();
    render(<VentasPage />);

    await llenarFormulario(user);
    await user.click(screen.getByRole("button", { name: "Registrar venta" }));
    await user.click(screen.getByRole("button", { name: "Sí, registrar venta" }));

    // Mensaje de éxito + botón de deshacer con cuenta regresiva.
    expect(await screen.findByText(/Venta #5 registrada/)).toBeInTheDocument();
    const deshacer = screen.getByRole("button", { name: /Deshacer \(\d+s\)/ });
    expect(deshacer).toBeInTheDocument();

    await user.click(deshacer);
    await waitFor(() => expect(anularCalled).toBe(true));
    // El aviso de deshacer desaparece tras confirmar la anulación.
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /Deshacer/ })).not.toBeInTheDocument();
    });
    expect(screen.queryByText(/Venta #5 registrada/)).not.toBeInTheDocument();
  });

  it("shows the API error on the undo attempt", async () => {
    server.use(
      rest.get("/api/sesion", (_req, res, ctx) => res(ctx.json({ usuario: mockUsuarioEmpleado }))),
      rest.get("/api/clientes", (_req, res, ctx) => res(ctx.json({ clientes }))),
      rest.get("/api/productos", (_req, res, ctx) => res(ctx.json({ productos }))),
      rest.get("/api/bodegas", (_req, res, ctx) => res(ctx.json({ bodegas }))),
      rest.get("/api/gestion-inventario", (_req, res, ctx) => res(ctx.json({ stock }))),
      rest.get("/api/ventas", (_req, res, ctx) => res(ctx.json({ ventas: [] }))),
      rest.post("/api/ventas", (_req, res, ctx) =>
        res(ctx.json({ id_venta: 5, total: 50 }))
      ),
      rest.post("/api/ventas/5/anular", (_req, res, ctx) =>
        res(ctx.status(400), ctx.json({ error: "Ya pasaron más de 10 minutos desde esta venta" }))
      )
    );

    const user = userEvent.setup();
    render(<VentasPage />);

    await llenarFormulario(user);
    await user.click(screen.getByRole("button", { name: "Registrar venta" }));
    await user.click(screen.getByRole("button", { name: "Sí, registrar venta" }));

    await screen.findByText(/Venta #5 registrada/);
    await user.click(screen.getByRole("button", { name: /Deshacer \(\d+s\)/ }));

    expect(await screen.findByText(/Ya pasaron más de 10 minutos/)).toBeInTheDocument();
  });
});