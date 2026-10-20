import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { rest } from "msw";
import { setupServer } from "msw/node";
import { PresentacionesProducto } from "@/components/inventario-catalogo/PresentacionesProducto";
import { sugerenciasPresentaciones, type Presentacion } from "@/lib/presentaciones";

const server = setupServer(rest.get("/api/presentaciones", (req, res, ctx) =>
  res(ctx.json({ presentaciones: sugerenciasPresentaciones(req.url.searchParams.get("unidad_medida") || "") }))
));
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function Editor({ unidad = "libra", iniciales = [] }: { unidad?: string; iniciales?: Presentacion[] }) {
  const [value, onChange] = useState(iniciales);
  return <PresentacionesProducto unidad={unidad} value={value} onChange={onChange} />;
}

describe("PresentacionesProducto", () => {
  it("shows five initial suggestions and searches the full list, including conversions outside the sample", async () => {
    const user = userEvent.setup();
    render(<Editor />);
    const input = screen.getByRole("combobox", { name: "Buscar presentaciones" });
    await user.click(input);
    expect(screen.getAllByRole("option")).toHaveLength(5);
    await user.type(input, "quintal");
    expect(screen.getAllByRole("option")).toHaveLength(1);
    await user.click(screen.getByRole("option", { name: "Quintal (100 libras) · 100 libra" }));
    expect(screen.getByRole("button", { name: "Quitar Quintal (100 libras)" })).toBeInTheDocument();
  });

  it("creates a fractional conversion and prevents duplicates and invalid factors", async () => {
    const user = userEvent.setup();
    render(<Editor />);
    await user.click(screen.getByRole("button", { name: "+ Crear presentación" }));
    await user.type(screen.getByLabelText("Nombre de presentación"), "Bolsa especial");
    await user.type(screen.getByLabelText("Equivalencia en libra"), "0");
    await user.click(screen.getByRole("button", { name: "Agregar al producto" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("La equivalencia debe ser positiva");
    await user.clear(screen.getByLabelText("Equivalencia en libra"));
    await user.type(screen.getByLabelText("Equivalencia en libra"), "0.125");
    await user.click(screen.getByRole("button", { name: "Agregar al producto" }));
    expect(screen.getByText("Bolsa especial · 0.125 libra")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "+ Crear presentación" }));
    await user.type(screen.getByLabelText("Nombre de presentación"), "bolsa especial");
    await user.type(screen.getByLabelText("Equivalencia en libra"), "2");
    await user.click(screen.getByRole("button", { name: "Agregar al producto" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("No se puede repetir");
  });

  it("filters out selected presentations and supports removing one", async () => {
    const user = userEvent.setup();
    render(<Editor iniciales={[{ id_presentacion: 7, nombre_presentacion: "Libra", factor_conversion: 1 }]} />);
    await user.click(screen.getByRole("combobox"));
    await user.type(screen.getByRole("combobox"), "libra");
    expect(screen.queryByRole("option", { name: "Libra · 1 libra" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Quitar Libra" }));
    expect(screen.queryByText("Libra · 1 libra")).not.toBeInTheDocument();
  });

  it("refreshes compatible suggestions when the unit changes", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Editor unidad="libra" />);
    rerender(<Editor unidad="litro" />);
    await user.click(screen.getByRole("combobox"));
    await user.type(screen.getByRole("combobox"), "250");
    expect(screen.getByRole("option", { name: "250 mililitros · 0.25 litro" })).toBeInTheDocument();
    expect(screen.queryByText(/Quintal/)).not.toBeInTheDocument();
  });

  it("can select custom presentations shared by compatible products", async () => {
    server.use(rest.get("/api/presentaciones", (_req, res, ctx) => res(ctx.json({ presentaciones: [
      ...sugerenciasPresentaciones("libra"), { nombre_presentacion: "Bulto especial", factor_conversion: 80 },
    ] }))));
    const user = userEvent.setup();
    render(<Editor />);
    const input = screen.getByRole("combobox");
    await user.click(input);
    await user.type(input, "Bulto");
    await user.click(await screen.findByRole("option", { name: "Bulto especial · 80 libra" }));
    expect(within(screen.getByRole("list")).getByText("Bulto especial · 80 libra")).toBeInTheDocument();
  });

  it("disables editing when existing presentations could not be loaded", () => {
    render(<PresentacionesProducto unidad="libra" value={[]} onChange={jest.fn()} disabled />);
    expect(screen.getByRole("combobox")).toBeDisabled();
    expect(screen.getByRole("button", { name: "+ Crear presentación" })).toBeDisabled();
  });
});
