import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { rest } from "msw";
import { setupServer } from "msw/node";
import BodegaPage from "@/app/bodega/page";

jest.mock("next/navigation", () => ({ useRouter: () => ({ replace: jest.fn() }) }));
jest.mock("@/hooks/useBodegueroSession", () => {
  const usuario = { id_usuario: 3, nombre: "Bodeguero", tipo_usuario: "BODEGUERO", id_bodega: 1 };
  return { useBodegueroSession: () => usuario };
});

const lineas = [
  { cantidad: "48", unidad_medida: "unidad", nombre_presentacion: "Caja de 24", cantidad_presentacion: "2" },
  { cantidad: "5", unidad_medida: "unidad", nombre_presentacion: null, cantidad_presentacion: null },
  { cantidad: "12", unidad_medida: "unidad", nombre_presentacion: "Caja de 24", cantidad_presentacion: null },
  { cantidad: "6", unidad_medida: "unidad", nombre_presentacion: null, cantidad_presentacion: "1" },
];

const server = setupServer(
  rest.get("/api/recepciones", (_req, res, ctx) => res(ctx.json({ recepciones: [] }))),
  rest.get("/api/productos", (_req, res, ctx) => res(ctx.json({ productos: [] }))),
  rest.get("/api/productos/frecuentes", (_req, res, ctx) => res(ctx.json({ productos: [] }))),
  rest.get("/api/bodegas/simple", (_req, res, ctx) => res(ctx.json({ bodegas: [] }))),
  rest.get("/api/bodega/historial", (_req, res, ctx) => res(ctx.json({ movimientos: lineas.map((linea, i) => ({
    ...linea, id_kardex: i + 1, fecha_movimiento: "2026-10-20T12:00:00Z",
    tipo_movimiento: i === 0 ? "ENTRADA" : "SALIDA", nombre_producto: `Producto ${i}`,
  })) }))),
  rest.get("/api/bodega/pedidos", (_req, res, ctx) => res(ctx.json({ pedidos: [{
    id_orden: 1, fecha_orden: "2026-10-20T12:00:00Z", estado: "CONFIRMADO", nombre_cliente: "Cliente",
    productos: [
      ...lineas.map((linea, i) => ({ ...linea, id_detalle: i + 1, nombre_producto: `Producto ${i}`, es_mi_bodega: true })),
      { ...lineas[0], id_detalle: 5, nombre_producto: "Otra bodega", es_mi_bodega: false },
    ],
  }] }))),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

it("muestra las presentaciones capturadas en pedidos y conserva las unidades sin presentación completa", async () => {
  render(<BodegaPage />);
  await screen.findByText("Pedido #1");
  expect(screen.getByText("Producto 0", { exact: false })).toHaveTextContent("2 Caja de 24 — Producto 0");
  expect(screen.getByText("Producto 1", { exact: false })).toHaveTextContent("5 unidad — Producto 1");
  expect(screen.getByText("Producto 2", { exact: false })).toHaveTextContent("12 unidad — Producto 2");
  expect(screen.getByText("Producto 3", { exact: false })).toHaveTextContent("6 unidad — Producto 3");
  expect(screen.queryByText(/48 unidad/)).not.toBeInTheDocument();
  expect(screen.queryByText(/Otra bodega/)).not.toBeInTheDocument();
});

it("muestra el ingreso en su presentación y conserva cantidades y signos de movimientos en unidades", async () => {
  const user = userEvent.setup();
  render(<BodegaPage />);
  await user.click(screen.getByRole("button", { name: "Entrada" }));
  expect(await screen.findByText("+ 2 Caja de 24")).toBeInTheDocument();
  expect(screen.getByText("− 5 unidad")).toBeInTheDocument();
  expect(screen.getByText("− 12 unidad")).toBeInTheDocument();
  expect(screen.getByText("− 6 unidad")).toBeInTheDocument();
  expect(screen.queryByText(/48 unidad/)).not.toBeInTheDocument();
});
