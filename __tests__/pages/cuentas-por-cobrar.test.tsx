import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { rest } from "msw";
import { setupServer } from "msw/node";

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(),
}));

import { useRouter, usePathname } from "next/navigation";
import CuentasPorCobrarPage from "@/app/cuentas-por-cobrar/page";

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

const notifConfigPorDefecto = { activo: false, intervalo_dias: 7, actualizado_en: null, actualizado_por: null };

function setupServerDeudas(deudas: unknown[]) {
  server.use(
    rest.get("/api/sesion", (_req, res, ctx) => res(ctx.json({ usuario: mockUsuarioDueno }))),
    rest.get("/api/deudas", (_req, res, ctx) => res(ctx.json({ deudas }))),
    rest.get("/api/productos", (_req, res, ctx) => res(ctx.json({ productos }))),
    rest.get("/api/clientes", (_req, res, ctx) => res(ctx.json({ clientes }))),
    rest.get("/api/configuracion/notificaciones-deuda", (_req, res, ctx) =>
      res(ctx.json({ configuracion: notifConfigPorDefecto }))
    )
  );
}

describe("CuentasPorCobrarPage", () => {
  beforeEach(() => {
    (useRouter as jest.Mock).mockReturnValue({ replace: mockReplace });
    (usePathname as jest.Mock).mockReturnValue("/cuentas-por-cobrar");
  });

  it("shows the percentage of the debt covered as a number + progress bar", async () => {
    setupServerDeudas([deudaBase()]);
    const user = userEvent.setup();
    render(<CuentasPorCobrarPage />);

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
    render(<CuentasPorCobrarPage />);

    await user.click(await screen.findByRole("button", { name: "Detalle" }));
    expect(await screen.findByText("Cubierto al 100%")).toBeInTheDocument();
  });

  it("opens the payment form and cancels without registering anything", async () => {
    setupServerDeudas([deudaBase()]);
    const user = userEvent.setup();
    render(<CuentasPorCobrarPage />);

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
      rest.get("/api/configuracion/notificaciones-deuda", (_req, res, ctx) =>
        res(ctx.json({ configuracion: notifConfigPorDefecto }))
      ),
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
    render(<CuentasPorCobrarPage />);

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

  it("lets the dueño view and change the automatic debt-reminder settings", async () => {
    setupServerDeudas([deudaBase()]);
    let patchedBody: unknown = null;
    let ejecutado = false;
    let configActual = { ...notifConfigPorDefecto };
    server.use(
      rest.patch("/api/configuracion/notificaciones-deuda", async (req, res, ctx) => {
        patchedBody = await req.json();
        configActual = { ...configActual, ...(patchedBody as object) };
        return res(ctx.json({ configuracion: configActual }));
      }),
      rest.post("/api/configuracion/notificaciones-deuda/ejecutar-ahora", (_req, res, ctx) => {
        ejecutado = true;
        return res(ctx.json({ activo: true, procesados: 2, enviados: 2, fallidos: 0 }));
      })
    );

    const user = userEvent.setup();
    render(<CuentasPorCobrarPage />);

    await user.click(await screen.findByRole("button", { name: "Notificaciones" }));
    expect(await screen.findByText(/Envío automático desactivado/)).toBeInTheDocument();

    // Activar el envío automático.
    await user.click(screen.getByRole("checkbox"));
    await waitFor(() => expect(patchedBody).toEqual({ activo: true }));
    expect(await screen.findByText(/Envío automático activado/)).toBeInTheDocument();

    // Cambiar el intervalo.
    const inputIntervalo = screen.getByRole("spinbutton");
    await user.clear(inputIntervalo);
    await user.type(inputIntervalo, "14");
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(patchedBody).toEqual({ intervalo_dias: 14 }));

    // Enviar ahora.
    await user.click(screen.getByRole("button", { name: "Enviar ahora" }));
    await waitFor(() => expect(ejecutado).toBe(true));
    expect(await screen.findByText(/2 enviados/)).toBeInTheDocument();
  });

  it("shows the error from the API when the payment fails", async () => {
    server.use(
      rest.get("/api/sesion", (_req, res, ctx) => res(ctx.json({ usuario: mockUsuarioDueno }))),
      rest.get("/api/deudas", (_req, res, ctx) => res(ctx.json({ deudas: [deudaBase()] }))),
      rest.get("/api/productos", (_req, res, ctx) => res(ctx.json({ productos }))),
      rest.get("/api/clientes", (_req, res, ctx) => res(ctx.json({ clientes }))),
      rest.get("/api/configuracion/notificaciones-deuda", (_req, res, ctx) =>
        res(ctx.json({ configuracion: notifConfigPorDefecto }))
      ),
      rest.post("/api/deudas/1/pagos", (_req, res, ctx) =>
        res(ctx.status(400), ctx.json({ error: "El pago es mayor al saldo pendiente." }))
      )
    );

    const user = userEvent.setup();
    render(<CuentasPorCobrarPage />);

    await user.click(await screen.findByRole("button", { name: "Detalle" }));
    await user.click(await screen.findByRole("button", { name: "Registrar pago" }));

    await user.type(screen.getByPlaceholderText("0.00"), "999");
    await user.click(screen.getByRole("button", { name: "Guardar pago" }));

    expect(await screen.findByText("El pago es mayor al saldo pendiente.")).toBeInTheDocument();
  });
});

describe("CuentasPorCobrarPage — crédito desde Ventas", () => {
  beforeEach(() => {
    (useRouter as jest.Mock).mockReturnValue({ replace: mockReplace });
    (usePathname as jest.Mock).mockReturnValue("/cuentas-por-cobrar");
  });

  const deudaCredito = () =>
    deudaBase({
      id_venta: 12,
      numero_factura: "FACT-000042",
      plazo_dias: 30,
      numero_cuotas: 2,
      fecha_limite_pago: "2026-11-10",
      total_pagado: "70.00",
      saldo_pendiente: "30.00",
      porcentaje_cubierto: "70",
      cuotas: [
        { numero: 1, fecha_vencimiento: "2026-10-26", monto: 50, pagado: 50, saldo: 0, estado: "PAGADA" },
        { numero: 2, fecha_vencimiento: "2026-11-10", monto: 50, pagado: 20, saldo: 30, estado: "PARCIAL" },
      ],
    });

  it("is named Cuentas por cobrar and tells that credit sales are registered from Ventas", async () => {
    setupServerDeudas([]);
    render(<CuentasPorCobrarPage />);
    expect(await screen.findByText(/Las ventas a crédito se registran desde/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Registrar venta a crédito" })).not.toBeInTheDocument();
    expect(screen.getAllByText("Cuentas por cobrar").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Límites de crédito" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+ Saldo anterior (sin venta)" })).toBeInTheDocument();
  });

  it("shows the invoice, the plazo and the payment plan with the state of each cuota", async () => {
    setupServerDeudas([deudaCredito()]);
    const user = userEvent.setup();
    render(<CuentasPorCobrarPage />);

    await user.click(await screen.findByRole("button", { name: "Detalle" }));
    expect(await screen.findByText(/Factura FACT-000042 · Crédito a 30 días · 2 pagos/)).toBeInTheDocument();

    const plan = screen.getByRole("table", { name: "Plan de pagos de la cuenta 1" });
    expect(plan).toHaveTextContent("26/10/2026");
    expect(plan).toHaveTextContent("10/11/2026");
    expect(plan).toHaveTextContent("Pagada");
    expect(plan).toHaveTextContent("Pago parcial");
  });

  it("marks overdue cuotas and does not show a plan for accounts without sale", async () => {
    setupServerDeudas([
      deudaBase({
        id_deuda: 2,
        id_venta: 13,
        plazo_dias: 30,
        numero_cuotas: 1,
        cuotas: [{ numero: 1, fecha_vencimiento: "2026-01-10", monto: 100, pagado: 0, saldo: 100, estado: "VENCIDA" }],
      }),
    ]);
    const user = userEvent.setup();
    render(<CuentasPorCobrarPage />);
    await user.click(await screen.findByRole("button", { name: "Detalle" }));
    expect(await screen.findByText("Vencida")).toBeInTheDocument();
    expect(screen.getByText(/Crédito a 30 días · pago único/)).toBeInTheDocument();
  });

  it("accounts without a plan (saldo anterior) show no plan table", async () => {
    setupServerDeudas([deudaBase()]);
    const user = userEvent.setup();
    render(<CuentasPorCobrarPage />);
    await user.click(await screen.findByRole("button", { name: "Detalle" }));
    await screen.findByText("pendiente · 25%");
    expect(screen.queryByRole("table", { name: /Plan de pagos/ })).not.toBeInTheDocument();
  });
});

describe("CuentasPorCobrarPage — abonos según el plan de pagos", () => {
  beforeEach(() => {
    (useRouter as jest.Mock).mockReturnValue({ replace: mockReplace });
    (usePathname as jest.Mock).mockReturnValue("/cuentas-por-cobrar");
  });

  const cuenta = (cuotas: unknown[], extra: Record<string, unknown> = {}) =>
    deudaBase({
      id_venta: 5,
      plazo_dias: 30,
      numero_cuotas: cuotas.length,
      total_pagado: "0.00",
      saldo_pendiente: "300.00",
      monto_total: "300.00",
      porcentaje_cubierto: "0",
      pagos: [],
      cuotas,
      ...extra,
    });

  async function abrirPago(user: ReturnType<typeof userEvent.setup>) {
    await user.click(await screen.findByRole("button", { name: "Detalle" }));
    await user.click(await screen.findByRole("button", { name: "Registrar pago" }));
  }

  it("pago único: the amount is fixed to the full balance and cannot be changed", async () => {
    setupServerDeudas([
      cuenta([{ numero: 1, fecha_vencimiento: "2099-12-31", monto: 300, pagado: 0, saldo: 300, estado: "PENDIENTE" }]),
    ]);
    const user = userEvent.setup();
    render(<CuentasPorCobrarPage />);
    await abrirPago(user);

    expect(screen.getByText(/Pago único: se debe pagar completo \(Q300\.00\)/)).toBeInTheDocument();
    const monto = screen.getByPlaceholderText("0.00");
    expect(monto).toHaveValue(300);
    expect(monto).toHaveAttribute("readonly");
    expect(screen.queryByText("Abonar todo")).not.toBeInTheDocument();
  });

  it("several pagos: suggests the current cuota as the minimum and allows paying more", async () => {
    setupServerDeudas([
      cuenta([
        { numero: 1, fecha_vencimiento: "2099-11-01", monto: 100, pagado: 0, saldo: 100, estado: "PENDIENTE" },
        { numero: 2, fecha_vencimiento: "2099-11-15", monto: 100, pagado: 0, saldo: 100, estado: "PENDIENTE" },
        { numero: 3, fecha_vencimiento: "2099-11-30", monto: 100, pagado: 0, saldo: 100, estado: "PENDIENTE" },
      ]),
    ]);
    const user = userEvent.setup();
    render(<CuentasPorCobrarPage />);
    await abrirPago(user);

    expect(screen.getByText(/Pago 1 de 3: mínimo Q100\.00/)).toBeInTheDocument();
    const monto = screen.getByPlaceholderText("0.00");
    expect(monto).toHaveValue(100); // propone la cuota que toca
    expect(screen.getByText("Abonar todo")).toBeInTheDocument();

    // Menos que la cuota: se rechaza sin llamar al servidor.
    await user.clear(monto);
    await user.type(monto, "40");
    await user.click(screen.getByRole("button", { name: "Guardar pago" }));
    expect(await screen.findByText(/El pago mínimo es Q100\.00 \(pago 1 de 3\)/)).toBeInTheDocument();
  });

  it("an account without a plan (saldo anterior) keeps free abonos", async () => {
    setupServerDeudas([deudaBase()]);
    const user = userEvent.setup();
    render(<CuentasPorCobrarPage />);
    await abrirPago(user);
    expect(screen.queryByText(/Pago único/)).not.toBeInTheDocument();
    expect(screen.queryByText(/mínimo Q/)).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText("0.00")).toHaveValue(null);
  });
});

describe("CuentasPorCobrarPage — saldo anterior", () => {
  beforeEach(() => {
    (useRouter as jest.Mock).mockReturnValue({ replace: mockReplace });
    (usePathname as jest.Mock).mockReturnValue("/cuentas-por-cobrar");
  });

  it("is just client + amount (no products) and posts a monto_libre", async () => {
    let body: Record<string, unknown> | null = null;
    setupServerDeudas([]);
    server.use(
      rest.post("/api/deudas", async (req, res, ctx) => {
        body = (await req.json()) as Record<string, unknown>;
        return res(ctx.status(201), ctx.json({ deuda: { id_deuda: 9 }, alerta: null }));
      })
    );
    const user = userEvent.setup();
    render(<CuentasPorCobrarPage />);

    await user.click(await screen.findByRole("button", { name: "+ Saldo anterior (sin venta)" }));
    expect(screen.queryByText("Productos *")).not.toBeInTheDocument();
    expect(screen.queryByText("+ Agregar producto")).not.toBeInTheDocument();

    await user.type(screen.getByPlaceholderText("Escribe el nombre para buscar…"), "Pedro");
    await user.click(await screen.findByText("Pedro Díaz"));
    await user.type(screen.getByLabelText("Saldo anterior"), "350.50");
    await user.click(screen.getByRole("button", { name: "Guardar saldo anterior" }));

    await waitFor(() => expect(body).not.toBeNull());
    expect(body).toMatchObject({ id_cliente: 1, nombre_deudor: "Pedro Díaz", monto_libre: 350.5 });
    expect(body).not.toHaveProperty("productos");
    expect(await screen.findByText("Saldo anterior registrado.")).toBeInTheDocument();
  });

  it("requires a positive amount", async () => {
    setupServerDeudas([]);
    const user = userEvent.setup();
    render(<CuentasPorCobrarPage />);
    await user.click(await screen.findByRole("button", { name: "+ Saldo anterior (sin venta)" }));
    await user.type(screen.getByPlaceholderText("Escribe el nombre para buscar…"), "Pedro");
    await user.click(await screen.findByText("Pedro Díaz"));
    await user.click(screen.getByRole("button", { name: "Guardar saldo anterior" }));
    expect(await screen.findByText("El saldo anterior debe ser un monto mayor a 0.")).toBeInTheDocument();
  });
});
