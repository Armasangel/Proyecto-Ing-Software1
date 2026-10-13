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
  { id_cliente: 1, nombre: "Carlos Ruiz", correo: "carlos@email.com", tipo_cliente: "MINORISTA", total_ventas: 1 },
  { id_cliente: 2, nombre: "Distribuidora El Sol", correo: "sol@email.com", tipo_cliente: "MAYORISTA", total_ventas: 3 },
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
  await screen.findByText("Bodega Central");

  // El cliente ya no es un <select>: es un buscador con sugerencias. Al
  // enfocarlo (sin escribir nada) debe aparecer como sugerencia frecuente.
  const buscadorCliente = await screen.findByPlaceholderText("Buscar cliente por nombre o correo…");
  await user.click(buscadorCliente);
  await user.click(await screen.findByText("Carlos Ruiz (carlos@email.com)"));

  // El producto tampoco es un <select>: es un buscador que sugiere 5 al azar
  // al enfocarlo (acá solo hay uno en el catálogo).
  await user.click(screen.getByRole("textbox", { name: "Producto" }));
  await user.click(await screen.findByText("Leche Entera"));

  const combos = screen.getAllByRole("combobox");
  // Orden del DOM (ya sin los <select> de cliente, producto y forma de pago,
  // que son un buscador y botones): tipo de entrega, bodega. El tipo de venta
  // ya no es un <select> propio salvo que se active "Forzar un tipo distinto
  // al del cliente" — se detecta solo a partir del tipo_cliente del cliente.
  await user.selectOptions(combos[1], "1"); // bodega

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

  it("auto-detects tipo_venta from the selected cliente's tipo_cliente", async () => {
    setupServerVentas();
    const user = userEvent.setup();
    render(<VentasPage />);

    const buscadorCliente = await screen.findByPlaceholderText("Buscar cliente por nombre o correo…");
    await user.click(buscadorCliente);

    // Cliente minorista → se detecta Minorista.
    await user.click(await screen.findByText("Carlos Ruiz (carlos@email.com)"));
    expect(await screen.findByText("Minorista")).toBeInTheDocument();

    // Cambiar a un cliente mayorista (buscándolo) → se re-detecta Mayorista
    // solo, sin que el colaborador tenga que tocar nada más.
    await user.click(buscadorCliente);
    await user.clear(buscadorCliente);
    await user.type(buscadorCliente, "Sol");
    await user.click(await screen.findByText("Distribuidora El Sol (sol@email.com)"));
    expect(await screen.findByText("Mayorista")).toBeInTheDocument();
    expect(screen.getByText("detectado del cliente")).toBeInTheDocument();

    // Con "forzar" activado sí vuelve a aparecer el <select> manual.
    const forzarCheckbox = screen.getByRole("checkbox", { name: /Forzar un tipo distinto al del cliente/ });
    await user.click(forzarCheckbox);
    expect(screen.getByDisplayValue("Mayorista")).toBeInTheDocument();
  });

  it("suggests the top clients by ventas when the search box is empty, and filters by text", async () => {
    setupServerVentas();
    const user = userEvent.setup();
    render(<VentasPage />);

    const buscadorCliente = await screen.findByPlaceholderText("Buscar cliente por nombre o correo…");
    await user.click(buscadorCliente);

    // Sin escribir nada, aparecen los clientes frecuentes.
    expect(await screen.findByText("Clientes frecuentes")).toBeInTheDocument();
    expect(screen.getByText("Carlos Ruiz (carlos@email.com)")).toBeInTheDocument();
    expect(screen.getByText("Distribuidora El Sol (sol@email.com)")).toBeInTheDocument();
    // El de más ventas (3) aparece marcado.
    expect(screen.getByText("3 ventas")).toBeInTheDocument();

    // Al escribir, filtra y deja de mostrar el encabezado de "frecuentes".
    await user.type(buscadorCliente, "sol");
    await waitFor(() => {
      expect(screen.queryByText("Clientes frecuentes")).not.toBeInTheDocument();
    });
    expect(screen.getByText("Distribuidora El Sol (sol@email.com)")).toBeInTheDocument();
    expect(screen.queryByText("Carlos Ruiz (carlos@email.com)")).not.toBeInTheDocument();
  });

  it("no se cae al buscar cuando hay un cliente sin correo, y no muestra '(null)'", async () => {
    server.use(
      rest.get("/api/sesion", (_req, res, ctx) => res(ctx.json({ usuario: mockUsuarioEmpleado }))),
      rest.get("/api/clientes", (_req, res, ctx) =>
        res(ctx.json({ clientes: [...clientes, { id_cliente: 3, nombre: "Roberto Sin Correo", correo: null, tipo_cliente: "MINORISTA", total_ventas: 0 }] }))
      ),
      rest.get("/api/productos", (_req, res, ctx) => res(ctx.json({ productos }))),
      rest.get("/api/bodegas", (_req, res, ctx) => res(ctx.json({ bodegas }))),
      rest.get("/api/gestion-inventario", (_req, res, ctx) => res(ctx.json({ stock }))),
      rest.get("/api/ventas", (_req, res, ctx) => res(ctx.json({ ventas: [] })))
    );
    const user = userEvent.setup();
    render(<VentasPage />);

    const buscadorCliente = await screen.findByPlaceholderText("Buscar cliente por nombre o correo…");
    await user.type(buscadorCliente, "rob");

    // Antes del arreglo, escribir aquí tiraba la página completa ("Algo salió mal en esta pantalla").
    expect(await screen.findByText("Roberto Sin Correo")).toBeInTheDocument();
    expect(screen.queryByText(/null/)).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText("Buscar cliente por nombre o correo…")).toBeInTheDocument();
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

describe("VentasPage — cliente nuevo", () => {
  beforeEach(() => {
    (useRouter as jest.Mock).mockReturnValue({ replace: mockReplace, push: mockReplace });
    (usePathname as jest.Mock).mockReturnValue("/ventas");
  });

  async function abrirFormulario(user: ReturnType<typeof userEvent.setup>) {
    await screen.findByPlaceholderText("Buscar cliente por nombre o correo…");
    await user.click(screen.getByRole("button", { name: "+ Cliente nuevo" }));
    return {
      nombre: screen.getByPlaceholderText("Nombre del cliente"),
      correo: screen.getByPlaceholderText("nombre@correo.com"),
    };
  }

  it("requires the correo (and a valid one) before creating the client", async () => {
    setupServerVentas();
    const posts: unknown[] = [];
    server.use(
      rest.post("/api/clientes", async (req, res, ctx) => {
        posts.push(await req.json());
        return res(ctx.status(201), ctx.json({ cliente: {} }));
      })
    );
    const user = userEvent.setup();
    render(<VentasPage />);
    const { nombre, correo } = await abrirFormulario(user);

    await user.type(nombre, "Pedro Nuevo");
    await user.click(screen.getByRole("button", { name: "Crear cliente" }));
    expect(await screen.findByText(/correo es obligatorio/i)).toBeInTheDocument();

    await user.type(correo, "no-es-correo");
    await user.click(screen.getByRole("button", { name: "Crear cliente" }));
    expect(await screen.findByText(/correo válido/i)).toBeInTheDocument();
    expect(posts).toHaveLength(0);
  });

  it("creates the client, selects it and detects its tipo_venta", async () => {
    setupServerVentas();
    let body: Record<string, unknown> | null = null;
    server.use(
      rest.post("/api/clientes", async (req, res, ctx) => {
        body = (await req.json()) as Record<string, unknown>;
        return res(
          ctx.status(201),
          ctx.json({
            cliente: { id_cliente: 9, nombre: "Pedro Nuevo", correo: "pedro@correo.com", tipo_cliente: "MAYORISTA", telefono: null, limite_deuda: null },
          })
        );
      })
    );
    const user = userEvent.setup();
    render(<VentasPage />);
    const { nombre, correo } = await abrirFormulario(user);

    await user.type(nombre, "Pedro Nuevo");
    await user.type(correo, "pedro@correo.com");
    await user.selectOptions(screen.getByDisplayValue("Minorista"), "MAYORISTA");
    await user.click(screen.getByRole("button", { name: "Crear cliente" }));

    expect(await screen.findByText(/Cliente "Pedro Nuevo" creado y seleccionado/)).toBeInTheDocument();
    expect(body).toMatchObject({ nombre: "Pedro Nuevo", correo: "pedro@correo.com", tipo_cliente: "MAYORISTA" });
    expect(screen.getByPlaceholderText("Buscar cliente por nombre o correo…")).toHaveValue("Pedro Nuevo (pedro@correo.com)");
    expect(await screen.findByText("Mayorista")).toBeInTheDocument();
    // El formulario se cierra tras crear.
    expect(screen.queryByPlaceholderText("Nombre del cliente")).not.toBeInTheDocument();
  });

  it("shows the API error (e.g. duplicated correo) and keeps the form open", async () => {
    setupServerVentas();
    server.use(
      rest.post("/api/clientes", (_req, res, ctx) =>
        res(ctx.status(400), ctx.json({ error: "Ya existe un cliente registrado con ese correo" }))
      )
    );
    const user = userEvent.setup();
    render(<VentasPage />);
    const { nombre, correo } = await abrirFormulario(user);
    await user.type(nombre, "Carlos Ruiz");
    await user.type(correo, "carlos@email.com");
    await user.click(screen.getByRole("button", { name: "Crear cliente" }));
    expect(await screen.findByText("Ya existe un cliente registrado con ese correo")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Nombre del cliente")).toBeInTheDocument();
  });
});

describe("VentasPage — contado o crédito", () => {
  beforeEach(() => {
    (useRouter as jest.Mock).mockReturnValue({ replace: mockReplace, push: mockReplace });
    (usePathname as jest.Mock).mockReturnValue("/ventas");
  });

  function servidorConVenta(onPost: (body: Record<string, unknown>) => void, respuesta: Record<string, unknown>) {
    server.use(
      rest.get("/api/sesion", (_req, res, ctx) => res(ctx.json({ usuario: mockUsuarioEmpleado }))),
      rest.get("/api/clientes", (_req, res, ctx) => res(ctx.json({ clientes }))),
      rest.get("/api/productos", (_req, res, ctx) => res(ctx.json({ productos }))),
      rest.get("/api/bodegas", (_req, res, ctx) => res(ctx.json({ bodegas }))),
      rest.get("/api/gestion-inventario", (_req, res, ctx) => res(ctx.json({ stock }))),
      rest.get("/api/ventas", (_req, res, ctx) => res(ctx.json({ ventas: [] }))),
      rest.post("/api/ventas", async (req, res, ctx) => {
        onPost((await req.json()) as Record<string, unknown>);
        return res(ctx.json(respuesta));
      })
    );
  }

  it("is Contado by default: no credit panel and the sale is sent as CONTADO", async () => {
    let body: Record<string, unknown> = {};
    servidorConVenta((b) => (body = b), { id_venta: 7, total: 50, condicion_pago: "CONTADO" });
    const user = userEvent.setup();
    render(<VentasPage />);
    await llenarFormulario(user);

    expect(screen.getByRole("button", { name: "Contado" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByText("Condiciones del crédito")).not.toBeInTheDocument();
    expect(screen.getByText(/El cliente paga el total en este momento/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Registrar venta" }));
    expect(screen.getByText(/De contado: el cliente paga el total ahora/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Sí, registrar venta" }));

    await waitFor(() => expect(body.condicion_pago).toBe("CONTADO"));
    expect(body.credito).toBeUndefined();
    expect(body.estado_pago).toBeUndefined();
  });

  it("Crédito shows the conditions, previews the payment plan and sends them to the API", async () => {
    let body: Record<string, unknown> = {};
    servidorConVenta((b) => (body = b), {
      id_venta: 8,
      total: 50,
      condicion_pago: "CREDITO",
      credito: { numero_factura: "FACT-000123", fecha_limite_pago: "2026-12-31", bloqueado: false, alerta: { bloqueado: false } },
    });
    const user = userEvent.setup();
    render(<VentasPage />);
    await llenarFormulario(user); // total Q50.00

    await user.click(screen.getByRole("button", { name: "Crédito" }));
    expect(screen.getByText("Condiciones del crédito")).toBeInTheDocument();
    expect(screen.getByText(/Hoy,/)).toBeInTheDocument();

    // Pago único por defecto: una cuota con el total.
    expect(screen.getByText(/Pago único · vence/)).toBeInTheDocument();
    expect(screen.getByText("Q50.00", { selector: "span.font-semibold" })).toBeInTheDocument();

    // 2 pagos de Q25 y plazo de 60 días.
    await user.selectOptions(screen.getByLabelText("Número de pagos"), "2");
    await user.click(screen.getByRole("button", { name: "60 días" }));
    expect(screen.getByText(/Pago 1 · vence/)).toBeInTheDocument();
    expect(screen.getByText(/Pago 2 · vence/)).toBeInTheDocument();
    expect(screen.getAllByText("Q25.00", { selector: "span.font-semibold" })).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: "Registrar venta" }));
    expect(screen.getByText(/plazo de 60 días/)).toBeInTheDocument();
    expect(screen.getByText(/Se generará la factura y una cuenta por cobrar/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Sí, registrar venta" }));

    await waitFor(() => expect(body.condicion_pago).toBe("CREDITO"));
    expect(body.credito).toMatchObject({ plazo_dias: 60, numero_cuotas: 2 });
    expect((body.credito as { fecha_factura: string }).fecha_factura).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    // Muestra la factura; el colaborador no ve enlaces a las cuentas por cobrar.
    expect(await screen.findByText(/Factura FACT-000123/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Ver cuenta por cobrar" })).not.toBeInTheDocument();
  });

  it("lets the colaborador force another invoice date", async () => {
    let body: Record<string, unknown> = {};
    servidorConVenta((b) => (body = b), { id_venta: 9, total: 50, credito: { numero_factura: "FACT-000124", fecha_limite_pago: "2026-12-31" } });
    const user = userEvent.setup();
    render(<VentasPage />);
    await llenarFormulario(user);
    await user.click(screen.getByRole("button", { name: "Crédito" }));

    await user.click(screen.getByRole("checkbox", { name: "Elegir otra fecha" }));
    // Sin elegir la fecha todavía no se puede registrar.
    expect(screen.getByText("Elige la fecha de la factura")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Registrar venta" })).toBeDisabled();

    const campoFecha = screen.getByLabelText("Fecha de la factura");
    const ayer = new Date(Date.now() - 86_400_000);
    const iso = `${ayer.getFullYear()}-${String(ayer.getMonth() + 1).padStart(2, "0")}-${String(ayer.getDate()).padStart(2, "0")}`;
    await user.type(campoFecha, iso);
    await user.click(screen.getByRole("button", { name: "Registrar venta" }));
    await user.click(screen.getByRole("button", { name: "Sí, registrar venta" }));

    await waitFor(() => expect((body.credito as { fecha_factura: string })?.fecha_factura).toBe(iso));
  });

  it("blocks registering a credit with more payments than days of plazo", async () => {
    servidorConVenta(() => undefined, {});
    const user = userEvent.setup();
    render(<VentasPage />);
    await llenarFormulario(user);
    await user.click(screen.getByRole("button", { name: "Crédito" }));

    const plazo = screen.getByLabelText("Plazo en días");
    await user.clear(plazo);
    await user.type(plazo, "3");
    await user.selectOptions(screen.getByLabelText("Número de pagos"), "4");

    expect(screen.getByText("No puede haber más pagos que días de plazo")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Registrar venta" })).toBeDisabled();
  });
});
