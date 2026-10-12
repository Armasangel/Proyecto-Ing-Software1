import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { rest } from "msw";
import { setupServer } from "msw/node";

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(),
}));

import { useRouter, usePathname } from "next/navigation";
import EstadisticasPage from "@/app/reportes/page";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => { server.resetHandlers(); jest.clearAllMocks(); });
afterAll(() => server.close());

const mockUsuarioDueno = { id_usuario: 1, nombre: "Juan Pérez", correo: "juan@tienda.com", tipo_usuario: "DUENO" };

const producto = {
  id_producto: 1, codigo_producto: "ARR-01", nombre_producto: "Arroz 1 lb", unidad_medida: "lb",
  nombre_categoria: "Granos", nombre_marca: "Del Campo", total_unidades: 120, total_ingresos: 600, veces_vendido: 30,
};

const deudores = Array.from({ length: 7 }, (_, i) => ({
  id_cliente: i + 1, nombre: `Deudor ${i + 1}`, telefono: null, limite_deuda: null,
  puede_comprar: true, deuda_pendiente: 100 - i, cantidad_deudas: 1,
}));

function estadisticas(overrides: Record<string, unknown> = {}) {
  return {
    periodo: { tipo: "month", desde: null, hasta: null },
    resumen: { total_ventas: 40, ingresos_totales: 5000, ticket_promedio: 125, ventas_canceladas: 2 },
    estadisticas_descriptivas: { media: 125, mediana: 110, moda: [100], desviacion_estandar: 33, min_total: 10, max_total: 400, n: 40 },
    ventas_por_dia: [{ fecha: "2026-09-01", total_dia: 300, cantidad: 3 }],
    ventas_por_tipo: [
      { tipo_venta: "MINORISTA", cantidad: 30, ingresos: 3000 },
      { tipo_venta: "MAYORISTA", cantidad: 10, ingresos: 2000 },
    ],
    ventas_por_estado: [
      { estado_venta: "PAGADO", cantidad: 35 },
      { estado_venta: "CANCELADO", cantidad: 2 },
    ],
    top_productos: [producto],
    producto_mas_comprado: producto,
    top_clientes: [{ id_cliente: 9, nombre: "María Compradora", correo: "maria@mail.com", tipo_usuario: "CLIENTE", total_compras: 800, cantidad_pedidos: 4 }],
    ingresos_por_categoria: [{ nombre_categoria: "Granos", total_ingresos: 2000, total_unidades: 300 }],
    ventas_por_hora: [{ hora: 9, cantidad: 5 }],
    comparativa_periodo_anterior: null,
    top_bodegas: [{ id_bodega: 1, nombre_bodega: "Bodega Central", total_movimientos: 12, total_unidades: 340 }],
    deudas: {
      resumen: { deuda_pendiente_total: 964, cantidad_deudores: 7, cantidad_deudas_pendientes: 7, clientes_bloqueados: 0, deuda_promedio_por_deudor: 137 },
      top_deudores: deudores,
    },
    kpis: {
      ventas: { ticket_promedio: 125, ventas_credito: 10, monto_credito: 1000, pct_ventas_credito: 25 },
      inventario: {
        productos_bajo_minimo: 3,
        detalle_bajo_minimo: [{ id_producto: 5, nombre_producto: "Aceite 1 L", nombre_bodega: "Bodega Central", cantidad_disponible: 2, stock_minimo: 10 }],
        rotacion_inventario: 1.5,
        productos_sin_movimiento: 4,
        detalle_sin_movimiento: [{ id_producto: 6, nombre_producto: "Sal fina", nombre_bodega: "Bodega Central", cantidad_disponible: 50, valor_inmovilizado: 250 }],
      },
      deuda: { pct_cartera_vencida: 10, tasa_recuperacion: 70, deuda_pendiente_bloqueados: 0 },
      operacion: { ventas_pendientes: 3, monto_ventas_pendientes: 450, pct_cancelacion: 5, pedidos_pendientes: 2, monto_pedidos_pendientes: 300 },
    },
    ...overrides,
  };
}

function setup(datos = estadisticas()) {
  const periodosPedidos: (string | null)[] = [];
  server.use(
    rest.get("/api/sesion", (_req, res, ctx) => res(ctx.json({ usuario: mockUsuarioDueno }))),
    rest.get("/api/estadisticas", (req, res, ctx) => {
      periodosPedidos.push(req.url.searchParams.get("periodo"));
      return res(ctx.json(datos));
    }),
  );
  return periodosPedidos;
}

describe("Reportes (EstadisticasPage)", () => {
  beforeEach(() => {
    (useRouter as jest.Mock).mockReturnValue({ replace: jest.fn() });
    (usePathname as jest.Mock).mockReturnValue("/reportes");
  });

  it("abre en la pestaña Ventas con números en palabras sencillas", async () => {
    setup();
    render(<EstadisticasPage />);

    expect(await screen.findByRole("tab", { name: "Ventas", selected: true })).toBeInTheDocument();
    expect(screen.getByText("Ventas fiadas")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Ventas fiadas" })).toHaveAttribute("aria-valuenow", "25");
    expect(screen.getByText("Ventas por terminar")).toBeInTheDocument();
    expect(screen.getByText("Cómo se vendió")).toBeInTheDocument();
    expect(screen.getByText("Minorista · 30 · Q3,000.00")).toBeInTheDocument();
  });

  it("ya no muestra los KPIs técnicos ni las estadísticas descriptivas", async () => {
    setup();
    render(<EstadisticasPage />);
    await screen.findByRole("tab", { name: "Ventas" });

    for (const texto of ["KPIs de negocio", "Rotación de inventario", "Cartera vencida", "% cancelación", "Resumen de tus ventas", "Qué tanto varían tus ventas"]) {
      expect(screen.queryByText(texto)).not.toBeInTheDocument();
    }
  });

  it("no dibuja gráficas de pastel: usa barra dividida y contadores", async () => {
    setup();
    render(<EstadisticasPage />);
    await screen.findByText("Cómo se vendió");

    expect(document.querySelectorAll("svg path[d*=' A ']")).toHaveLength(0);
    expect(screen.getByText("Pagado")).toBeInTheDocument();
    expect(screen.getByText("Cancelado")).toBeInTheDocument();
  });

  it("la hora más movida es una frase, ya no una gráfica", async () => {
    setup(estadisticas({ ventas_por_hora: [{ hora: 8, cantidad: 4 }, { hora: 17, cantidad: 12 }, { hora: 20, cantidad: 6 }] }));
    render(<EstadisticasPage />);

    expect(await screen.findByText("Hora más movida")).toBeInTheDocument();
    expect(screen.getByText("17:00 h")).toBeInTheDocument();
    expect(screen.getByText("12 ventas a esa hora")).toBeInTheDocument();
    expect(screen.queryByText("Actividad por hora del día")).not.toBeInTheDocument();
  });

  it("con ventas de un solo día no dibuja una barra gigante, avisa con texto", async () => {
    setup(); // el ejemplo base tiene un solo día
    render(<EstadisticasPage />);

    expect(await screen.findByText("Ingresos por día (Q)")).toBeInTheDocument();
    expect(screen.getByText(/Solo hay ventas de un día/)).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "Ingresos en el periodo" })).not.toBeInTheDocument();
    expect(screen.getByText(/Día con más ventas/)).toBeInTheDocument();
  });

  it("los ingresos pasan a semanas o meses según el largo del periodo", async () => {
    const dias = (desde: string, n: number) =>
      Array.from({ length: n }, (_, i) => ({
        fecha: new Date(new Date(`${desde}T00:00:00Z`).getTime() + i * 86_400_000).toISOString().slice(0, 10),
        total_dia: 50, cantidad: 1,
      }));

    setup(estadisticas({ ventas_por_dia: dias("2026-07-01", 90) }));
    const { unmount } = render(<EstadisticasPage />);
    expect(await screen.findByText("Ingresos por semana (Q)")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Ingresos en el periodo" })).toBeInTheDocument();
    unmount();

    setup(estadisticas({ ventas_por_dia: dias("2025-10-01", 365) }));
    render(<EstadisticasPage />);
    expect(await screen.findByText("Ingresos por mes (Q)")).toBeInTheDocument();
  });

  it("Inventario: lo que hay que reponer y el dinero parado, con ingresos por categoría solo en barras", async () => {
    setup();
    const user = userEvent.setup();
    render(<EstadisticasPage />);
    await user.click(await screen.findByRole("tab", { name: "Inventario" }));

    expect(screen.getByText("Por reponer")).toBeInTheDocument();
    expect(screen.getByText("Aceite 1 L")).toBeInTheDocument();
    expect(screen.getByText("Dinero parado en bodega")).toBeInTheDocument();
    expect(screen.getByText("Sal fina")).toBeInTheDocument();
    expect(screen.getByText("Ingresos por categoría")).toBeInTheDocument();
    expect(document.querySelectorAll("svg path[d*=' A ']")).toHaveLength(0);
  });

  it("Clientes y deudas: muestra solo 5 deudores y enlaza a la página de Deudas", async () => {
    setup();
    const user = userEvent.setup();
    render(<EstadisticasPage />);
    await user.click(await screen.findByRole("tab", { name: "Clientes y deudas" }));

    expect(screen.getByText("Q964.00")).toBeInTheDocument();
    expect(screen.queryByText("Deuda promedio")).not.toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Fiado cobrado" })).toHaveAttribute("aria-valuenow", "70");
    expect(screen.getByText("Deudor 5")).toBeInTheDocument();
    expect(screen.queryByText("Deudor 6")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ver todas las deudas/ })).toHaveAttribute("href", "/deudas");
  });

  it("no muestra el enlace «Ver todas» si hay 5 deudores o menos", async () => {
    const datos = estadisticas();
    (datos.deudas as { top_deudores: unknown[]; resumen: Record<string, number> }).top_deudores = deudores.slice(0, 3);
    datos.deudas.resumen.cantidad_deudores = 3;
    setup(datos);
    const user = userEvent.setup();
    render(<EstadisticasPage />);
    await user.click(await screen.findByRole("tab", { name: "Clientes y deudas" }));

    expect(screen.queryByRole("link", { name: /Ver todas las deudas/ })).not.toBeInTheDocument();
  });

  it("los periodos fijos se aplican al tocarlos, sin botón Aplicar", async () => {
    const pedidos = setup();
    const user = userEvent.setup();
    render(<EstadisticasPage />);
    await screen.findByRole("tab", { name: "Ventas" });
    expect(screen.queryByRole("button", { name: "Aplicar" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "7 días" }));

    await waitFor(() => expect(pedidos).toContain("week"));
    expect(screen.getByRole("button", { name: "7 días" })).toHaveAttribute("aria-pressed", "true");
  });

  it("«Personalizado» pide fechas y espera al botón Aplicar", async () => {
    const pedidos = setup();
    const user = userEvent.setup();
    render(<EstadisticasPage />);
    await screen.findByRole("tab", { name: "Ventas" });
    const antes = pedidos.length;

    await user.click(screen.getByRole("button", { name: "Personalizado" }));
    expect(pedidos).toHaveLength(antes);

    await user.click(screen.getByRole("button", { name: "Aplicar" }));
    expect(await screen.findByText("Selecciona fechas de inicio y fin.")).toBeInTheDocument();
    expect(pedidos).toHaveLength(antes);
  });

  it("cambiar de pestaña conserva los datos sin volver a pedirlos", async () => {
    const pedidos = setup();
    const user = userEvent.setup();
    render(<EstadisticasPage />);
    await screen.findByRole("tab", { name: "Ventas" });
    const antes = pedidos.length;

    await user.click(screen.getByRole("tab", { name: "Inventario" }));
    await user.click(screen.getByRole("tab", { name: "Ventas" }));

    expect(pedidos).toHaveLength(antes);
    const panel = screen.getByRole("tabpanel");
    expect(within(panel).getByText("Ventas fiadas")).toBeInTheDocument();
  });
});
