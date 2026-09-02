import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { rest } from "msw";
import { setupServer } from "msw/node";

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(),
}));

import { useRouter, usePathname } from "next/navigation";
import DeudasPage from "@/app/deudas/page";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => { server.resetHandlers(); jest.clearAllMocks(); });
afterAll(() => server.close());

const mockReplace = jest.fn();
const mockUsuarioDueno = { id_usuario: 1, nombre: "Juan Pérez", correo: "juan@tienda.com", tipo_usuario: "DUENO" };

const productos = [
  { id_producto: 1, nombre_producto: "Leche Entera", precio_unitario: "25.00", unidad_medida: "Litro" },
];

const clientes = [
  { id_cliente: 1, nombre: "Pedro Díaz", telefono: "87654321", correo: null, tipo_cliente: "MINORISTA", estado_cliente: true, limite_deuda: null },
];

function deudaBase(overrides: Record<string, unknown> = {}) {
  return {
    id_deuda: 1,
    nombre_deudor: "Pedro Díaz",
    telefono_deudor: "87654321",
    fecha_inicio: "2026-07-01",
    fecha_limite_pago: null,
    monto_total: "100.00",
    estado_deuda: "PENDIENTE",
    productos: [{ id_producto: 1, nombre_producto: "Leche Entera", cantidad: "4", precio_unitario: "25.00", subtotal: "100.00" }],
    id_cliente: 1,
    limite_deuda: null,
    cliente_puede_comprar: true,
    total_pagado: "25.00",
    saldo_pendiente: "75.00",
    porcentaje_cubierto: "25",
    pagos: [
      { id_pago: 1, monto: "25.00", fecha_pago: "2026-07-10T10:00:00.000Z", metodo_pago: "EFECTIVO", nota: null, registrado_por: "Juan Pérez" },
    ],
    ...overrides,
  } as Record<string, unknown>;
}

function setupServerDeudas(deudas: unknown[]) {
  server.use(
    rest.get("/api/sesion", (_req, res, ctx) => res(ctx.json({ usuario: mockUsuarioDueno }))),
    rest.get("/api/deudas", (_req, res, ctx) => res(ctx.json({ deudas }))),
    rest.get("/api/productos", (_req, res, ctx) => res(ctx.json({ productos }))),
    rest.get("/api/clientes", (_req, res, ctx) => res(ctx.json({ clientes })))
  );
}

describe("DeudasPage", () => {
  beforeEach(() => {
    (useRouter as jest.Mock).mockReturnValue({ replace: mockReplace });
    (usePathname as jest.Mock).mockReturnValue("/deudas");
  });

  it("shows the percentage of the debt covered as a number + progress bar", async () => {
    setupServerDeudas([deudaBase()]);
    const user = userEvent.setup();
    render(<DeudasPage />);

    // Navegación principal en la vista por defecto (Acumulado por cliente).
    await user.click(await screen.findByRole("button", { name: "Detalle" }));

    await screen.findByText("pendiente · 25%");
    expect(screen.getByText("Q75.00")).toBeInTheDocument();
    // Q100.00 aparece como deuda acumulada del grupo y como monto de la deuda.
    expect(screen.getAllByText("Q100.00").length).toBeGreaterThanOrEqual(1);
  });

  it("shows 'Cubierto al 100%' for a fully paid debt", async () => {
    setupServerDeudas([deudaBase({ estado_deuda: "PAGADA", total_pagado: "100.00", saldo_pendiente: "0.00", porcentaje_cubierto: "100" })]);
    const user = userEvent.setup();
    render(<DeudasPage />);

    await user.click(await screen.findByRole("button", { name: "Detalle" }));
    expect(await screen.findByText("Cubierto al 100%")).toBeInTheDocument();
  });

  it("opens the payment form and cancels without registering anything", async () => {
    setupServerDeudas([deudaBase()]);
    const user = userEvent.setup();
    render(<DeudasPage />);

    await user.click(await screen.findByRole("button", { name: "Detalle" }));
    await user.click(await screen.findByRole("button", { name: "Registrar pago" }));

    expect(screen.getByText(/Monto a abonar/)).toBeInTheDocument();
    expect(screen.getByText("Abonar todo")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByText(/Monto a abonar/)).not.toBeInTheDocument();
  });

  it("registers a partial payment via POST /api/deudas/:id/pagos", async () => {
    let postedBody: unknown = null;
    server.use(
      rest.get("/api/sesion", (_req, res, ctx) => res(ctx.json({ usuario: mockUsuarioDueno }))),
      rest.get("/api/deudas", (_req, res, ctx) => res(ctx.json({ deudas: [deudaBase()] }))),
      rest.get("/api/productos", (_req, res, ctx) => res(ctx.json({ productos }))),
      rest.get("/api/clientes", (_req, res, ctx) => res(ctx.json({ clientes }))),
      rest.post("/api/deudas/1/pagos", async (req, res, ctx) => {
        postedBody = await req.json();
        return res(
          ctx.status(201),
          ctx.json({
            pago: { id_pago: 2, id_deuda: 1, monto: "30.00" },
            saldo_pendiente: 45,
            estado_deuda: "PENDIENTE",
            alerta: null,
          })
        );
      })
    );

    const user = userEvent.setup();
    render(<DeudasPage />);

    await user.click(await screen.findByRole("button", { name: "Detalle" }));
    await user.click(await screen.findByRole("button", { name: "Registrar pago" }));

    await user.type(screen.getByPlaceholderText("0.00"), "30");
    await user.click(screen.getByRole("button", { name: "Guardar pago" }));

    await waitFor(() => expect(postedBody).not.toBeNull());
    expect(postedBody).toEqual({ monto: 30, metodo_pago: "EFECTIVO" });

    // El formulario se cierra tras registrar el pago.
    await waitFor(() => {
      expect(screen.queryByText(/Monto a abonar/)).not.toBeInTheDocument();
    });
  });

  it("shows the error from the API when the payment fails", async () => {
    server.use(
      rest.get("/api/sesion", (_req, res, ctx) => res(ctx.json({ usuario: mockUsuarioDueno }))),
      rest.get("/api/deudas", (_req, res, ctx) => res(ctx.json({ deudas: [deudaBase()] }))),
      rest.get("/api/productos", (_req, res, ctx) => res(ctx.json({ productos }))),
      rest.get("/api/clientes", (_req, res, ctx) => res(ctx.json({ clientes }))),
      rest.post("/api/deudas/1/pagos", (_req, res, ctx) =>
        res(ctx.status(400), ctx.json({ error: "El pago es mayor al saldo pendiente." }))
      )
    );

    const user = userEvent.setup();
    render(<DeudasPage />);

    await user.click(await screen.findByRole("button", { name: "Detalle" }));
    await user.click(await screen.findByRole("button", { name: "Registrar pago" }));

    await user.type(screen.getByPlaceholderText("0.00"), "999");
    await user.click(screen.getByRole("button", { name: "Guardar pago" }));

    expect(await screen.findByText("El pago es mayor al saldo pendiente.")).toBeInTheDocument();
  });
});